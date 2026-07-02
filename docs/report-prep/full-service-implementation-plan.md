# 실제 서비스형 MVP 확장 구현 계획

## 1. 현재 구현 상태 요약

| 영역 | 현재 구현 상태 | mock/미연결 여부 | 주요 파일 | 문제점 |
|---|---|---|---|---|
| 인증/세션 | NestJS Auth, bcrypt, JWT access/refresh, Redis refresh 세션, 전역 ValidationPipe 구현됨 | mock 아님. 프론트 access token은 메모리 보관 | `backend/src/modules/auth`, `backend/src/modules/redis`, `frontend/src/auth`, `frontend/src/api/client.ts` | 소셜 로그인/비밀번호 재설정 UI는 준비 중이며 `api-spec.md`에 엔드포인트 없음 |
| 상품 | CRUD, 검색, 내 상품, 찜, 작성자 검증, DTO whitelist 구현됨 | mock 아님 | `backend/src/modules/products`, `frontend/src/pages/HomePage.tsx`, `ProductDetailPage.tsx`, `ProductFormPage.tsx` | 실제 e2e 증거는 부족. 공개/숨김/소유자 정책은 통합 검증 필요 |
| 상품 이미지 업로드 | Fastify multipart, 확장자/MIME/시그니처/UUID 저장 검증 구현됨 | mock 아님. 프론트 업로드는 등록/수정 폼에 연결됨 | `backend/src/modules/products/products.controller.ts`, `products.service.ts`, `frontend/src/api/products.ts` | 이미지 저장 경로/정적 제공/실제 업로드 e2e 증거 필요 |
| 채팅 | REST 채팅방/메시지와 Socket.IO gateway 구현됨. 참여자 검증과 WS 보안 테스트 추가됨 | mock 아님 | `backend/src/modules/chats`, `frontend/src/pages/ChatsPage.tsx` | 브라우저 기반 Socket.IO e2e 증거는 아직 부족 |
| 거래 | 요청/예약/취소/완료/상세/후기, 서버 기준 amount, 상태 전이 구현됨 | mock 아님 | `backend/src/modules/transactions`, `frontend/src/pages/TransactionsPage.tsx` | 동시성/중복 판매는 단위 테스트 중심. DB 기반 race 증거 필요 |
| 안전결제/에스크로 | 결제 생성, Toss approve, webhook HMAC, confirm/refund/receipt 구현됨 | provider mock 테스트 존재. 실제 Toss sandbox 수동 검증 필요 | `backend/src/modules/payments`, `frontend/src/api/payments.ts`, `TransactionsPage.tsx` | 외부 test key/webhook endpoint 없이 실제 승인/취소 증거 미확보 |
| 신고 | USER/PRODUCT/CHAT 신고, 내 신고 목록 구현됨 | mock 아님 | `backend/src/modules/reports`, `frontend/src/pages/ReportsPage.tsx` | 프론트에서 신고 생성 진입점이 제한적이면 연결 보강 필요 |
| 관리자 | 신고/상품/사용자/로그 API와 Admin UI 구현됨. RolesGuard와 AdminLog 보안 테스트 추가됨 | mock 아님 | `backend/src/modules/admin`, `frontend/src/pages/AdminPages.tsx` | 관리자 액션의 HTTP e2e/스크린샷 증거는 추가 필요 |
| 알림 | 본인 알림 조회/읽음 처리, 채팅/결제 연동 일부 구현됨 | mock 아님 | `backend/src/modules/notifications`, `frontend/src/pages/NotificationsPage.tsx` | 알림 생성 트리거 범위가 도메인별로 불균형할 수 있어 점검 필요 |
| 프론트 API 연결 | 대부분 실제 API 사용. axios refresh, React Query, WS 연결 구현됨. unsupported/mock-only UI 제거 작업 진행됨 | 실제 mock-only UI 노출 없음 | `frontend/src/api/*`, `frontend/src/pages/*` | 정적 grep 결과 `전달 준비` 상태 라벨과 이미지 fallback 문구만 남음 |
| 보안 테스트 | Vitest 단위/컨트롤러/DTO 테스트 풍부. 최근 문서상 231 tests 통과 기록 | e2e 디렉터리 없음 | `backend/src/**/*.spec.ts`, `docs/test-checklist.md`, `docs/security-review-log.md` | `backend/test`, `backend/test/e2e`, 루트 `test` 없음. 보고서용 자동 e2e 증거 필요 |

## 2. 실제 서비스형 구현 우선순위

| 우선순위 | 영역 | 구현 작업 | 관련 FR | 관련 SR | 완료 기준 | 보고서 증거 |
|---|---|---|---|---|---|---|
| 1 | 공통 보안 파이프라인 | ValidationPipe, Helmet/CORS, RateLimit, JwtAuthGuard DB status 재조회, RolesGuard ACTIVE 검증을 e2e로 고정 | 공통 | SR-11, SR-15, SR-34, SR-36, SR-37, SR-38, SR-39 | lint/test/build + 보안 smoke e2e 통과 | 파이프라인 테스트 결과, guard 실패/성공 캡처 |
| 2 | 인증/세션 안정화 | 준비 중인 소셜/비밀번호 재설정 UI 제거 또는 비노출. refresh/logout 실제 흐름 검증 | FR-01~04 | SR-01~04, SR-11, SR-15, SR-39 | localStorage/sessionStorage 토큰 저장 없음, refresh rotation 테스트 | grep 결과, auth 테스트 결과 |
| 3 | 상품 CRUD + 이미지 업로드 | 상품 CRUD/검색/찜/이미지 업로드를 DB 기반 e2e로 검증하고 업로드 증거 정리 | FR-07~15 | SR-06, SR-11~21, SR-35, SR-39 | 작성자만 수정/삭제/업로드, 위장 파일 거부 | 업로드 거부/성공 테스트, 저장 파일 UUID 증거 |
| 4 | 채팅 실제 연결 | REST + WS 메시지 송수신, 참여자 검증, 차단 연동을 e2e화 | FR-16~22 | SR-07, SR-13, SR-34, SR-35, SR-39 | 비참여자 접근/WS join 거부, 메시지 실제 저장 | HTTP/WS 테스트 로그 |
| 5 | 거래 상태 머신 | 요청/예약/취소/완료/후기 상태 전이와 동시 요청 방어 검증 | FR-23~29 | SR-08, SR-10, SR-15, SR-26, SR-35, SR-39 | 클라 status/amount 무시, 당사자만 전이 | 상태 전이 전후 DB/API 증거 |
| 6 | 안전결제/에스크로 시뮬레이션 | 결제 생성/approve/webhook/confirm/refund를 test provider와 HMAC으로 검증 | FR-30~38 | SR-22~28, SR-30, SR-35, SR-37 | amount 조작/webhook 위조 거부, escrowReleased 정책 통과 | 결제 보안 테스트 결과 |
| 7 | 신고/관리자 실제 연결 | 신고 생성 진입점 보강, 관리자 처리/로그 UI/API 검증 | FR-39~46 | SR-05, SR-09, SR-15, SR-28, SR-36, SR-39 | 일반 사용자 admin 접근 403, AdminLog 생성 | admin guard/action 로그 증거 |
| 8 | 알림 실제 연결 | 채팅/거래/신고 처리 알림 트리거 점검 및 누락 보강 | FR-47~50 | SR-39 | 본인 알림만 조회/읽음, 타인 알림 404 | notification BOLA 테스트 |
| 9 | 프론트 mock 제거 | 준비 중 버튼/페이지 제거, api-spec 없는 기능 숨김, 실제 API 오류/빈 상태 정리 | NFR-01, NFR-09 | SR-15, SR-39 | `rg mock|dummy|준비|coming soon|Placeholder` 결과가 의도된 항목만 남음 | grep 결과, 화면 캡처 |
| 10 | 보안 e2e 테스트 | 취약점별 자동화 테스트와 보고서 증거 매트릭스 생성 | NFR-08 | 전체 SR | e2e + unit + build 통과 | `docs/report-prep/*` 증거 문서 |

## 3. 대규모 구현 단계 분리

### Phase A. 백엔드 보안 기반 안정화

- 목표: 전역 보안 파이프라인과 인증/권한 정책을 보고서 증거로 고정한다.
- 수정 예상 파일: `backend/src/main.ts`, `backend/src/common/guards/*`, `backend/src/app.module.ts`, 보안 e2e 테스트 파일.
- 테스트: ValidationPipe mass assignment, suspended user 401, admin RolesGuard 403/통과, `$queryRawUnsafe` production 미사용 grep.
- 완료 기준: `npm run lint`, `npm run test`, `npm run build` 통과 및 보안 파이프라인 증거 문서화.

### Phase B. 상품/이미지 업로드 실제화

- 목표: 상품 CRUD/검색/찜/이미지 업로드가 실제 DB와 파일 저장소 기준으로 동작함을 검증한다.
- 수정 예상 파일: `backend/src/modules/products/*`, `frontend/src/pages/ProductFormPage.tsx`, `frontend/src/ui/imageUrl.ts`.
- 테스트: 작성자 외 수정/삭제/업로드 거부, SVG/이중확장자/위장 MIME 거부, 검색 SQLi payload 안전성.
- 완료 기준: 업로드 성공 파일은 UUID명이고 허용 이미지 외 파일은 400/415로 거부.

### Phase C. 채팅 실제화

- 목표: REST/Socket.IO 채팅을 실제 참여자 검증과 차단 정책으로 고정한다.
- 수정 예상 파일: `backend/src/modules/chats/*`, `frontend/src/pages/ChatsPage.tsx`.
- 테스트: 비참여자 채팅방/메시지 접근 거부, WS join/message 참여자 검증, XSS payload 문자열 렌더링.
- 완료 기준: HTTP와 WS 모두 currentUser 기준 검증을 통과해야 메시지 저장/수신 가능.
- 현재 증거: `backend/src/modules/chats/chats-ws-security.spec.ts` 추가. handshake 인증 실패, JWT subject 기준 사용자 식별, 비참여자 join/message 거부, senderId/userId/role 주입 거부, XSS payload 문자열 전달을 자동화했다.
- 남은 작업: 실제 브라우저 또는 Socket.IO client 기반 e2e로 room 수신 범위와 UI 렌더링을 추가 검증한다.

### Phase D. 거래/결제 실제화

- 목표: 거래 상태 머신과 안전결제 시뮬레이션을 서버 DB 기준으로 완성한다.
- 수정 예상 파일: `backend/src/modules/transactions/*`, `backend/src/modules/payments/*`, `frontend/src/pages/TransactionsPage.tsx`.
- 테스트: 클라이언트 `price/status/userId` 주입 거부, 중복 거래 race, idempotency, webhook HMAC, amount mismatch.
- 완료 기준: 거래/결제/환불/구매확정 흐름이 명세 상태만 허용하고 결제 금액은 서버 값만 사용.

### Phase E. 신고/관리자/알림 실제화

- 목표: 신고 접수부터 관리자 처리, AdminLog, 사용자 알림까지 실제 API로 연결한다.
- 수정 예상 파일: `backend/src/modules/reports/*`, `admin/*`, `notifications/*`, `frontend/src/pages/AdminPages.tsx`, `ReportsPage.tsx`, `NotificationsPage.tsx`.
- 테스트: 일반 사용자 admin 접근 403, role 주입 거부, 신고 중복 409, 타인 알림 읽음 404.
- 완료 기준: 관리자 조치마다 AdminLog가 생성되고 관련 알림이 본인에게만 노출.
- 현재 증거: `backend/src/modules/admin/admin-security.spec.ts` 추가. 관리자 controller guard/role metadata, USER 차단, role/status 주입 거부, 상품 숨김/사용자 제재/신고 처리 AdminLog 생성을 자동화했다.
- 남은 작업: 관리자 HTTP e2e, 신고 처리 후 알림 생성 여부, 관리자 UI 스크린샷 증거를 보강한다.

### Phase F. 프론트 mock 제거 및 API 연결

- 목표: 준비 화면/준비 버튼/placeholder를 실제 API 화면 또는 명세 밖 기능 숨김으로 정리한다.
- 수정 예상 파일: `frontend/src/App.tsx`, `frontend/src/pages/ForgotPasswordPage.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`, `MePage.tsx`, `PlaceholderPage.tsx`.
- 테스트: 프론트 build/lint, `rg "mock|dummy|TODO|준비|coming soon|PlaceholderPage"` 정적 확인.
- 완료 기준: api-spec에 없는 기능은 노출하지 않고, 노출된 화면은 실제 API를 호출한다.
- 현재 증거: `rg "mock|dummy|TODO|coming soon|준비|PlaceholderPage|ForgotPasswordPage|dummyimage|카카오|Kakao" frontend/src` 결과는 배송 상태 라벨 `전달 준비`와 이미지 fallback `사진 준비중`만 남았다. `localStorage/sessionStorage` 토큰 저장과 production `dangerouslySetInnerHTML` 사용은 발견되지 않았다.

### Phase G. 보안 e2e 테스트와 보고서 증거 확보

- 목표: 취약점별 전후/방어 증거를 자동 테스트와 문서로 남긴다.
- 수정 예상 파일: `backend/test/e2e` 또는 프로젝트 테스트 관례에 맞춘 e2e 파일, `docs/report-prep/*`.
- 테스트: BOLA, XSS, SQLi, upload, price tampering, admin bypass, CSRF/session, race, mass assignment, rate limit, sensitive exposure, webhook forgery.
- 완료 기준: `docs/report-prep/security-evidence-matrix.md`와 실행 로그가 최신 테스트 결과를 가리킴.
- 현재 증거: `docs/report-prep/security-evidence-matrix.md`와 `docs/report-prep/security-test-plan.md`에 파일 업로드, race condition, 채팅 WS, 관리자 액션 로그, 프론트 정적 점검, 전체 QA 결과를 기록했다.

## 4. 취약점별 구현 보강 계획

| 취약점 | 현재 상태 | 구현 보강 | 테스트 보강 | 보고서 증거 |
|---|---|---|---|---|
| IDOR / BOLA | 서비스 레벨 소유자/참여자 검증 다수 구현. 채팅 WS BOLA 테스트 추가 | 상품/채팅/거래/결제/알림 전부 e2e로 고정 | 타 사용자 객체 id 접근 403/404, WS 비참여자 join/message 거부 | `chats-ws-security.spec.ts`, 요청/응답 로그 |
| Stored XSS | React 텍스트 렌더링 중심, `dangerouslySetInnerHTML` production 미사용. 채팅 XSS payload 테스트 추가 | 사용자 입력 화면 전체 점검, HTML 렌더 금지 유지 | 상품 설명/채팅 XSS payload 저장 후 스크립트 미실행 | `chats-ws-security.spec.ts`, grep + 화면 캡처 |
| SQL Injection | Prisma ORM 사용, production `$queryRawUnsafe` 없음 | 검색/관리자 q 필터 전부 Prisma 조건 유지 | SQLi payload가 데이터 노출/500을 만들지 않음 | grep + 검색 테스트 |
| 파일 업로드 취약점 | 확장자/MIME/시그니처/UUID 검사 구현, Fastify multipart 통합 테스트 추가 | 정적 파일 제공 정책 점검 | 정상 PNG 성공, SVG/PHP/JSP/HTML/이중확장자/위장 MIME 거부, 타 사용자 403 | `backend/src/modules/products/products-upload.multipart.spec.ts`, `docs/report-prep/security-evidence-matrix.md` |
| 결제 금액 조작 | 결제/거래 amount 서버 계산 구현 | 프론트/백엔드 payload에서 amount 제거 유지 | `amount: 100` 주입 400 또는 무시, DB price 저장 | 결제 생성 테스트 |
| 관리자 권한 우회 | JwtAuthGuard + RolesGuard + ADMIN 적용. AdminLog 생성 테스트 추가 | 모든 admin controller guard reflection/e2e 고정 | 일반 USER `/admin/*` 403, role query/body 거부, AdminLog 생성 | `admin-security.spec.ts`, admin guard 테스트 |
| CSRF | refresh cookie SameSite 정책 있음 | 상태변경 API의 Authorization 요구와 SameSite 설정 증거화 | 쿠키만 있고 Bearer 없는 변경 요청 401 | auth/session 테스트 |
| Race Condition | 거래 예약 시 상품 상태 조건부 update 패턴 존재, 동시 예약 race 테스트 추가 | 결제 동시성 테스트 추가 | 같은 상품 동시 예약 2건 중 1건만 성공, 나머지 Conflict | `backend/src/modules/transactions/transactions-race.spec.ts`, `docs/report-prep/security-evidence-matrix.md` |
| Mass Assignment | DTO whitelist/forbidNonWhitelisted 구현 | 모든 DTO 권한 필드 주입 케이스 보강 | role/sellerId/userId/price/status 주입 400 | DTO 테스트 결과 |
| Rate Limit | ThrottlerModule 전역 설정 | 로그인/결제/채팅에 더 엄격한 route throttle 검토 | 반복 로그인/결제 요청 429 | rate limit 테스트 |
| 민감정보 노출 | 응답 DTO/선택 필드로 passwordHash/email/phone 제외 | 전 도메인 응답 snapshot 또는 assertion 보강 | passwordHash/token/secret 미포함 | grep + 응답 테스트 |
| Webhook Forgery | Toss HMAC verifier 구현 | raw body 기반 검증과 timestamp/signature 실패 케이스 고정 | invalid signature 401, DB 미변경 | webhook 테스트 로그 |

## 9. Phase C/E 보안 테스트 최신 상태

| 항목 | 상태 | 증거 | 남은 작업 |
|---|---|---|---|
| 채팅 WS handshake 인증 | 완료 | `backend/src/modules/chats/chats-ws-security.spec.ts` | 실제 Socket.IO client e2e |
| 채팅 비참여자 join/message 거부 | 완료 | `backend/src/modules/chats/chats-ws-security.spec.ts`, `chats.service.spec.ts` | 브라우저 room 수신 범위 검증 |
| 채팅 XSS payload 문자열 처리 | 완료 | `backend/src/modules/chats/chats-ws-security.spec.ts`, `chats.service.spec.ts` | 프론트 화면 캡처 증거 |
| 관리자 USER 접근 차단 | 완료 | `backend/src/modules/admin/admin-security.spec.ts`, `roles.guard.spec.ts` | HTTP e2e 403 증거 |
| 관리자 액션 AdminLog | 완료 | `backend/src/modules/admin/admin-security.spec.ts`, `admin.service.spec.ts` | 관리자 UI/스크린샷 증거 |
| 신고 처리 후 알림 | 확인필요 | 현재 AdminLog 중심 검증 | notification 생성 정책 확정 및 테스트 |
| 전체 QA | 완료 | `docs/report-prep/security-test-plan.md` | 최종 보고서용 실행 로그 캡처 |

## 5. 첫 구현 작업 추천

추천 후보 1: 보안 e2e/증거 기반 만들기

- 작업: `backend/test/e2e` 또는 현재 Vitest 관례에 맞는 보안 smoke 테스트를 추가하고, BOLA/mass assignment/admin bypass/payment amount 조작의 최소 케이스를 자동화한다.
- 장점: 보고서 증거가 가장 직접적이고 기존 백엔드 구조와 충돌이 적다.
- 검증: `cd backend && npm run lint && npm run test && npm run build`.

추천 후보 2: 프론트 준비 UI 제거

- 작업: `ForgotPasswordPage`, 카카오 로그인 버튼, 프로필 사진 저장 준비 토스트, 사용되지 않는 `PlaceholderPage`를 명세 밖 기능 숨김 또는 실제 연결로 정리한다.
- 장점: “실제 서비스처럼 동작” 요구에 바로 보인다.
- 검증: `cd frontend && npm run lint && npm run build`, 준비 키워드 grep.

추천 후보 3: 상품 이미지 업로드 통합 증거 보강

- 작업: 실제 multipart 업로드 성공/실패 테스트와 보고서 캡처용 시나리오를 추가한다.
- 장점: 파일 업로드 취약점 증거가 명확하다.
- 검증: 허용 이미지 성공, SVG/위장 파일 실패, UUID 파일명 확인.

가장 추천: 후보 1. 이미 백엔드 기능은 넓게 구현되어 있으므로, 다음 작업은 새 기능을 크게 늘리기보다 보안 e2e 증거 기반을 먼저 만드는 것이 작고 확실하다.

## 6. 실행한 검증 명령어

- `git status --short`
- `git diff --stat`
- `git branch --show-current`
- `sed -n`으로 `docs/requirements.md`, `docs/api-spec.md`, `docs/database-design.md`, `docs/architecture.md`, `docs/security-spec.md`, `docs/coding-conventions.md`, `docs/AGENT.md`, `docs/CLAUDE.md` 확인
- `sed -n`으로 `docs/report-notes.md`, `docs/security-review-log.md`, `docs/test-checklist.md` 확인
- `find backend/src backend/prisma ...`, `find frontend/src ...`
- `rg "mock|dummy|TODO|준비|coming soon|localStorage|sessionStorage|dangerouslySetInnerHTML|\\$queryRawUnsafe|..." backend/src backend/prisma frontend/src docs`
- `rg -n "@(Controller|Get|Post|Patch|Delete)|@UseGuards|@Roles" backend/src/modules`

코드 수정이 없었는지 확인 결과: 계획 작성 단계에서는 없음. 구현 단계에서는 이 문서와 보안 테스트 파일만 추가한다.

마지막 출력:

- 생성한 파일: `docs/report-prep/full-service-implementation-plan.md`
- 가장 먼저 구현해야 할 작업: 보안 smoke/e2e 테스트 기반 만들기
- 다음 Codex 프롬프트 초안: “백엔드 보안 smoke/e2e 테스트 기반을 추가해줘. 범위는 BOLA, Mass Assignment, Admin 우회, 결제 금액 조작 4개만 우선 다루고, `api-spec.md`에 없는 엔드포인트는 추가하지 마. 완료 후 `cd backend && npm run lint && npm run test && npm run build`와 관련 grep 결과를 보고해줘.”
- 코드 수정 여부: 문서와 테스트만 추가, production 코드 변경은 필요한 경우에만 수행

## 7. Phase B 파일 업로드 보안 증거

- 추가 테스트: `backend/src/modules/products/products-upload.multipart.spec.ts`
- 검증 범위: `POST /api/products/:id/images` Fastify multipart 경계, `JwtAuthGuard` 인증 사용자, `ProductsService` 실제 검증 로직.
- 성공 증거: 정상 PNG 업로드는 `products/<uuid>.png` URL을 반환하고 원본 파일명을 저장하지 않는다.
- 차단 증거: SVG, PHP, JSP, HTML, `shell.php.jpg`, plain text 위장 이미지, MIME/확장자 mismatch가 모두 400으로 거부된다.
- 접근제어 증거: 상품 작성자가 아닌 사용자는 이미지 업로드가 403으로 거부된다.
- 저장 경로 근거: 서비스는 `UPLOAD_DIR/products`에 UUID 파일명을 쓰며, 테스트는 임시 `UPLOAD_DIR`을 사용하고 종료 후 삭제한다. 기본 설정은 웹 루트가 아닌 `/var/app/uploads` 계열 경로다.
- production 패치 여부: 테스트가 기존 구현으로 통과해 production 코드는 변경하지 않았다.

## 8. Phase D Race Condition 보안 증거

- 추가 테스트: `backend/src/modules/transactions/transactions-race.spec.ts`
- 검증 범위: `TransactionsService.reserveTransaction`의 상품 상태 조건부 update와 거래 상태 전이를 동시 호출로 검증한다.
- 성공 증거: 같은 상품의 두 `REQUESTED` 거래를 동시에 예약하면 1건만 성공하고 1건은 `ConflictException`으로 실패한다.
- 중복 생성 방어: 예약 race 실패 경로에서 `transaction.create`와 `payment.create`는 호출되지 않는다.
- 최종 상태 근거: 상품 상태는 `RESERVED` 하나로 수렴하고, 두 거래 중 하나만 `RESERVED`가 된다.
- production 패치 여부: 기존 `product.updateMany({ status: ON_SALE })`와 `transaction.updateMany({ status: REQUESTED })` 조건부 전이로 테스트가 통과해 production 코드는 변경하지 않았다.
