# AGENT.md

범용 코딩 에이전트(Codex, Cursor, 기타)를 위한 지침. 내용은 `CLAUDE.md`와 동일한 규칙을 따른다. 두 파일을 함께 두면 어떤 에이전트가 잡든 동일한 기준으로 동작한다.

---

## TL;DR

보안 중심 중고거래 웹 서비스. 스택은 **NestJS + Prisma + PostgreSQL + Redis / React + Vite / Socket.IO / JWT(액세스+리프레시 회전)**. 기능 구현 후 **OWASP 기반 취약점 분석·패치**가 최종 목표.

작업 전 `docs/` 의 `requirements.md → api-spec.md → database-design.md → architecture.md → security-spec.md → coding-conventions.md` 순으로 확인.

---

## 반드시 지킬 보안 규칙 (요약)

| # | 규칙 | 근거 |
|---|------|------|
| 1 | 클라가 보낸 userId/role/price/status 불신, 토큰 sub + DB로만 판단 | SR-15 |
| 2 | 모든 객체 접근에 소유자/참여자 검증 (BOLA — 1순위) | SR-06~10,35 |
| 3 | 결제 금액은 서버가 product.price로 재계산 | SR-22 |
| 4 | SQL은 Prisma 바인딩만, raw 금지 | SR-12 |
| 5 | 업로드: 확장자+MIME+매직바이트, UUID명, 실행불가 경로 | SR-16~21 |
| 6 | 비밀번호 bcrypt/Argon2, 로그에 비번/토큰/계좌 금지 | SR-01,31 |
| 7 | DTO 화이트리스트로 Mass Assignment 차단 | SR-15 |
| 8 | 응답 민감필드 제거 | SR-39 |
| 9 | 시크릿 .env, 하드코딩/커밋 금지 | NFR-10 |
| 10 | 에러 전역 필터, 내부 정보 미노출 | NFR-07 |

---

## 구현 순서

1. **인프라**: docker-compose(postgres, redis), Prisma 스키마 → migrate
2. **auth**: 회원가입/로그인(bcrypt, 실패잠금)/토큰 회전/로그아웃
3. **users**: 프로필(본인만 수정), 공개/비공개 분리
4. **products**: CRUD(작성자 검증)/검색(바인딩)/이미지 업로드(검증)/찜
5. **chats**: 방 생성/목록/상세(참여자 검증)/메시지(escape)/WS 인증
6. **transactions**: 요청/예약/취소/완료(상태머신·당사자 검증)/후기
7. **payments**: 결제(금액 재계산·Idempotency)/웹훅(서명검증)/확정/환불/정산(에스크로)
8. **reports / admin**: 신고, 관리자(RolesGuard, 로그)
9. **notifications**: 본인 알림만
10. **보안 분석·패치**: security-spec.md §2 6종 시연→패치→전후비교, e2e 테스트

## 요청 파이프라인 순서

```
Helmet → CORS → RateLimit → ValidationPipe(whitelist)
→ JwtAuthGuard(DB status 재확인) → RolesGuard(role + ACTIVE)
→ Controller → Service(service-level ownership/participant validation)
→ Interceptor → GlobalExceptionFilter
```

## 금지 사항

- 권한 검사 생략·지연
- api-spec.md에 없는 엔드포인트 임의 추가(문서 먼저 갱신)
- 클라이언트 검증만 신뢰
- 민감정보 쿼리스트링 노출
- 보안 영향 미검토 의존성 추가

## 모호할 때

- 권한 주체 모호 → 토큰 sub + DB 소유 필드
- 상태 전이 모호 → architecture.md 거래 상태 머신
- 보안 판단 모호 → 더 보수적인(거부) 쪽

## 검증 명령

```bash
npm run lint && npm run test     # 커밋 전 필수
```
커밋 메시지에 관련 FR/SR ID를 적는다. 예: `security(chats): 채팅방 IDOR 참여자 검증 추가 (SR-07)`
