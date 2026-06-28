# CLAUDE.md

코딩 에이전트(Claude Code / Codex 등)가 이 저장소에서 작업할 때 따르는 지침. **보안이 1순위 목표인 프로젝트**임을 항상 전제한다.

---

## 프로젝트 한 줄 요약

당근마켓형 중고거래 웹 서비스. 상품·채팅·거래·안전결제·신고/관리자 기능을 구현하고, **개발 후 OWASP 기반 취약점 분석·패치까지 수행**하는 것이 최종 목표다.

## 기술 스택 (변경 금지)

- 백엔드: **NestJS (TypeScript)** + **Prisma** + **PostgreSQL** + **Redis**
- 프론트: **React + Vite + TypeScript**
- 채팅: **Socket.IO**
- 인증: **JWT 액세스(15m, 메모리) + 리프레시(httpOnly 쿠키, 회전)**

## 문서 우선순위 (작업 전 반드시 참조)

1. `docs/requirements.md` — FR/NFR/SR ID. 모든 작업은 ID에 매핑된다.
2. `docs/api-spec.md` — 엔드포인트·권한(🔒). 임의 변경 금지.
3. `docs/database-design.md` — Prisma 스키마 기준.
4. `docs/architecture.md` — 요청 파이프라인·상태머신·결제흐름.
5. `docs/security-spec.md` — 취약점·패치. 보안 결정의 근거.
6. `docs/coding-conventions.md` — 코딩/네이밍/테스트/Git 규칙.

---

## 절대 규칙 (Hard Rules) — 위반 시 작업 중단

1. **클라이언트가 보낸 `userId`/`role`/`price`/`status`를 신뢰하지 않는다.** 토큰의 `sub`와 DB 값으로만 판단한다.
2. **모든 객체 접근(조회·수정·삭제)에 소유자/참여자 검증을 서버에서 수행한다.** (BOLA/IDOR — 이 프로젝트 1순위 취약점). 상품=작성자, 채팅=참여자, 거래/결제=당사자, admin=ADMIN.
3. **결제 금액은 요청 본문에서 받지 않는다.** 서버가 `transaction → product.price`로 재계산한다(SR-22).
4. **SQL은 Prisma 파라미터 바인딩만.** `$queryRawUnsafe`는 보안 시연용 별도 엔드포인트 외 금지(SR-12).
5. **파일 업로드는 확장자+MIME+매직바이트 검증, UUID 파일명, 실행 불가 경로 저장.** SVG/HTML/PHP/JSP 차단(SR-16~21).
6. **비밀번호는 bcrypt/Argon2.** 평문·약한 해시 금지(SR-01). 로그에 비번/토큰/계좌 저장 금지(SR-31).
7. **DTO 화이트리스트**(`whitelist:true, forbidNonWhitelisted:true`)로 Mass Assignment 차단. DTO에 `role`/`sellerId` 같은 권한 필드 미포함(SR-15).
8. **응답에서 민감 필드 제거**(`@Exclude()`로 passwordHash 등)(SR-39).
9. **시크릿은 `.env`로만.** 절대 하드코딩·커밋 금지(NFR-10).
10. **에러는 전역 필터로.** 내부 스택/쿼리/구현 노출 금지(NFR-07).

---

## 작업 방식

### 새 기능 구현 시
1. 해당 FR/SR ID를 `requirements.md`에서 확인.
2. `api-spec.md`의 엔드포인트·권한 표시(🔒) 확인.
3. 모듈 구조(`module/controller/service/dto`)로 구현.
4. 권한 검사 → 서비스 진입부에 배치(또는 Guard).
5. DTO + class-validator로 입력 검증.
6. 해당 SR 체크리스트(`security-spec.md` §4)에 대응하는 테스트 추가.
7. 커밋 메시지에 FR/SR ID 기재.

### 보안 패치 작업 시
- `security-spec.md` §2의 취약 코드(❌) → 패치 코드(✅) 패턴을 따른다.
- 패치 전후 동작을 e2e 테스트로 증명한다(보고서 "전후 비교"에 사용).

### 의도적 취약 엔드포인트 (보고서 시연용)
- 일부 취약점(SQLi 등)은 **시연 후 패치**를 보여주기 위해 별도 브랜치/플래그(`VULN_DEMO=true`)로 구현한다.
- 운영 기본값은 항상 **안전한 코드**여야 한다.

---

## 요청 파이프라인 (반드시 이 순서)

```
Helmet → CORS → RateLimit → ValidationPipe(whitelist)
→ JwtAuthGuard(DB status 재확인) → RolesGuard(role + ACTIVE)
→ Controller → Service(service-level ownership/participant validation)
→ Interceptor(응답필터+감사로그)
→ GlobalExceptionFilter
```

## 명령어

```bash
docker compose up -d          # postgres, redis
cd backend && npm run start:dev
npx prisma migrate dev
npm run lint && npm run test   # 커밋 전 필수
cd frontend && npm run dev
```

## 하지 말 것

- 권한 검사 생략하고 "나중에 추가" — 금지. 처음부터 넣는다.
- 새 의존성 추가 시 보안 영향 검토 없이 설치.
- `api-spec.md`에 없는 엔드포인트를 임의로 만들기 — 먼저 문서 갱신.
- 클라이언트 검증만 믿고 서버 검증 생략.
- 민감정보를 URL 쿼리스트링에 싣기.

## 막힐 때

- 권한 주체가 모호하면: 항상 토큰 `sub` + DB 소유 필드로 판단.
- 상태 전이가 모호하면: `architecture.md`의 거래 상태 머신 참조.
- 보안 판단이 모호하면: 더 보수적인(접근 거부) 쪽을 택한다.
