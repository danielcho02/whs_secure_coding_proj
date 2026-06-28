# 보안 명세 (Threat Model & Vulnerability Analysis)

이 문서는 보고서의 6~10장(위협 모델링·취약점 분석·재현·패치·전후 비교)에 대응한다. 보안 기준: **OWASP Top 10, OWASP API Security Top 10, OWASP ASVS**.

> OWASP ASVS는 웹 애플리케이션의 기술적 보안 통제를 테스트하고 안전한 개발 요구사항 목록을 제공하는 검증 기준이다.

---

## 1. 위협 모델링 (STRIDE 요약)

| 위협 | 본 서비스 예시 | 대응 |
|------|---------------|------|
| **S**poofing | 토큰 위조·세션 탈취 | JWT 서명, httpOnly 쿠키, 토큰 회전 |
| **T**ampering | 결제 금액·거래 상태·role 조작 | 서버 재계산·상태머신·DTO 화이트리스트 |
| **R**epudiation | 관리자 조치 부인 | 감사·관리자 로그(append-only) |
| **I**nfo Disclosure | 타인 채팅/이메일/계좌 조회 | BOLA 검증·응답 필드 필터 |
| **D**oS | 로그인 무차별·결제 폭주 | Rate Limit·계정 잠금 |
| **E**oP | 일반 유저의 관리자 기능 사용 | RolesGuard 서버 검증 |

**신뢰 경계**: 브라우저 ↔ API(불신), API ↔ DB/Redis(신뢰), API ↔ PG 웹훅(서명으로만 신뢰). 클라이언트에서 온 모든 값은 데이터로만 취급한다.

---

## 2. 메인 취약점 6종 — 분석·재현·패치

각 항목은 보고서에 **취약 코드 → 공격 재현 → 패치 코드 → 전후 비교** 구조로 넣기 좋다.

### 2-1. IDOR / BOLA  (우선순위 1)
- **위치**: `GET /api/chats/:id`, `/api/transactions/:id`, `/api/payments/:id/receipt`
- **공격 재현**: 로그인 후 `GET /api/chats/3`을 `GET /api/chats/4`로 변경 → 타인 채팅방 열람.
- **취약 코드**
  ```ts
  // 소유자 검증 없음 ❌
  async getChat(id: string) {
    return this.prisma.chat.findUnique({ where: { id } });
  }
  ```
- **패치 (service-level ownership/participant validation)**
  ```ts
  async getChat(id: string, me: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id } });
    if (!chat) throw new NotFoundException();
    if (chat.buyerId !== me && chat.sellerId !== me)
      throw new ForbiddenException();        // ✅ 참여자만 (SR-07)
    return chat;
  }
  ```
- **검증(ASVS)**: V4 접근제어 — 모든 객체 접근에 인가 검사.

### 2-2. XSS (Stored, 상품설명·채팅)  (우선순위 2)
- **공격 재현**: 상품 설명/채팅에 `<img src=x onerror=alert(document.cookie)>` 삽입.
- **취약점**: React에서 `dangerouslySetInnerHTML`로 사용자 입력 렌더.
- **패치**
  - 출력: React 기본 텍스트 바인딩 사용(자동 escape). HTML이 필요하면 `DOMPurify.sanitize()` 후 렌더(SR-13).
  - 입력: 저장 전 정규화, 위험 태그 제거.
  - 방어 심화: CSP 헤더(`Content-Security-Policy`)로 인라인 스크립트 차단.
  - 액세스 토큰을 메모리에만 두어 쿠키 탈취 영향 최소화.

### 2-3. SQL Injection  (우선순위 3)
- **공격 재현**: 검색창에 `' OR '1'='1` 입력.
- **취약 코드 (의도적 취약 엔드포인트)**
  ```ts
  this.prisma.$queryRawUnsafe(
    `SELECT * FROM products WHERE title LIKE '%${q}%'`);  // ❌
  ```
- **패치**
  ```ts
  this.prisma.product.findMany({
    where: { title: { contains: q, mode: 'insensitive' } } }); // ✅ 파라미터 바인딩 (SR-12)
  ```
- **검증(ASVS)**: V5 검증·인코딩 — 파라미터화 쿼리.

### 2-4. 파일 업로드 취약점  (우선순위 4)
- **공격 재현**: `shell.php.jpg`, `폭탄.svg`(스크립트 포함) 업로드.
- **패치 체크리스트 (SR-16~21)**
  1. 확장자 화이트리스트: jpg/jpeg/png/webp만
  2. MIME 타입 검사 + **매직바이트(파일 시그니처)** 검사 (`file-type` 라이브러리)
  3. 크기 제한(`MAX_UPLOAD_SIZE`)
  4. 파일명 UUID 재생성(원본명 폐기)
  5. 웹 루트 밖, **실행 권한 없는 경로** 저장
  6. SVG/HTML/PHP/JSP 차단
  ```ts
  const ft = await fileTypeFromBuffer(buffer);
  const ALLOW = ['image/jpeg','image/png','image/webp'];
  if (!ft || !ALLOW.includes(ft.mime)) throw new BadRequestException();
  const name = `${randomUUID()}.${ft.ext}`;  // ✅
  ```

### 2-5. 결제 금액 조작 (Price Tampering)  (우선순위 5)
- **공격 재현**: `POST /api/payments`에서 `amount: 100` 전송.
- **취약점**: 클라이언트가 보낸 금액을 그대로 결제.
- **패치**
  ```ts
  // amount는 요청에서 받지 않음 ❌→ 서버에서 재계산 ✅
  const tx = await this.prisma.transaction.findUnique({
    where:{ id: dto.transactionId }, include:{ product:true }});
  const amount = tx.product.price;            // SR-22
  ```
- **웹훅 위조 동반 방어**: PG 웹훅 HMAC 서명 검증(SR-23), Idempotency 키(SR-24).

### 2-6. 관리자 권한 우회  (우선순위 6)
- **공격 재현**: 일반 유저가 `GET /api/admin/users` 직접 호출 / 회원가입·수정 시 `role:"ADMIN"` 주입.
- **패치**
  ```ts
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')                              // ✅ 서버 검증 (SR-09,36)
  @Controller('admin') class AdminController {}
  ```
  - 회원가입/수정 DTO에 `role` 미포함 → `whitelist`로 무시(Mass Assignment, SR-15).
  - 관리자 상태변경은 CSRF 토큰/SameSite로 보호.

---

## 3. 추가 분석 대상 (보고서 보강용)

| 취약점 | 공격 예시 | 패치 |
|--------|-----------|------|
| CSRF | 로그인된 판매자 상품 삭제 유도 | CSRF Token + SameSite |
| Race Condition | 동시 구매로 중복 판매 | 트랜잭션 + 조건부 update/락 |
| Mass Assignment | `role=ADMIN` 주입 | DTO whitelist, role 무시 |
| Rate Limit 부재 | 로그인 무차별 대입 | 요청 제한 + 계정 잠금 |
| 민감정보 노출 | 타인 email/phone 조회 | 응답 필드 제한(@Exclude) |
| Webhook Forgery | 가짜 결제완료 전송 | HMAC 서명 검증 |

---

## 4. 보안 테스트 체크리스트 (NFR-08)

- [ ] 타 사용자 토큰으로 객체 접근 시 403 (BOLA, 자동화 테스트)
- [ ] 검색 인젝션 페이로드가 데이터 노출로 이어지지 않음
- [ ] XSS 페이로드 저장 후 렌더 시 스크립트 미실행
- [ ] 비이미지/위장 파일 업로드 거부
- [ ] 금액 조작 결제 요청 시 서버 가격으로 강제
- [ ] 웹훅 서명 불일치 시 거부
- [ ] 일반 유저의 `/admin/*` 접근 403
- [ ] 로그인 6회 실패 시 잠금
- [ ] 동시 구매 요청 시 1건만 성공
- [ ] 응답 본문에 passwordHash/내부필드 미포함

---

## 5. 보고서 권장 목차

1. 프로젝트 개요
2. 서비스 주요 기능
3. 기능 요구사항
4. 비기능 요구사항
5. 보안 요구사항
6. 위협 모델링 (본 문서 §1)
7. 취약점 분석 (§2 취약 코드)
8. 취약점 재현 (§2 공격 재현)
9. 보안 패치 (§2 패치 코드)
10. 패치 전후 비교 (§2 ✅/❌ + 테스트 결과)
11. 결론
