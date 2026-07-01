# Phase 1 보안 구현 상태 진단

## 1. 전체 요약

- 작성 기준: 2026-07-01, 현재 브랜치 `security/report-evidence-prep`.
- 확인한 기준 문서: `docs/security-spec.md`, `docs/requirements.md`, `docs/api-spec.md`, `docs/architecture.md`, `docs/database-design.md`, `docs/coding-conventions.md`, `docs/AGENT.md`, `docs/CLAUDE.md`.
- 확인한 구현 범위: `backend/src`, `backend/prisma`, `frontend/src`, `docs`. `backend/test`, `backend/test/e2e`, 루트 `test` 디렉터리는 현재 확인되지 않았고, 테스트는 `backend/src/**/*.spec.ts` 중심으로 존재한다.

### 실제 구현된 기능

- 인증/세션: 회원가입, 로그인, refresh 회전, logout, bcrypt 해시, Redis refresh session/jti, 로그인 실패 잠금, HttpOnly/SameSite refresh cookie, access token 메모리 보관이 구현되어 있다.
- 상품: 목록/검색/상세/등록/수정/삭제/상태 변경/찜/이미지 업로드가 구현되어 있고, 상품 수정/삭제/업로드는 seller 검증을 수행한다.
- 채팅: REST 채팅방/메시지 API와 Socket.IO 게이트웨이가 구현되어 있고, HTTP/WS 모두 참여자 검증과 active 사용자 검증을 수행한다.
- 거래: 거래 요청, 예약, 취소, 완료, 목록/상세, 후기 작성이 구현되어 있고, 상태 전이는 Prisma transaction과 조건부 update로 처리한다.
- 안전결제: 결제 생성, Toss 승인, 웹훅, 구매 확정, 환불, 영수증 조회가 구현되어 있고, 결제 금액은 서버 DB 값과 대조한다.
- 신고/관리자: 사용자/상품/채팅 신고, 내 신고 조회, 관리자 신고 처리, 상품 숨김/복구, 사용자 정지/복구, 관리자 로그 조회가 구현되어 있다.
- 알림: 내 알림 조회와 읽음 처리가 구현되어 있고, 채팅 메시지 생성 시 알림 생성 코드가 확인된다.
- 프론트: 주요 기능 화면은 `frontend/src/api/*`를 통해 백엔드 API와 연결되어 있고, access token은 `frontend/src/api/client.ts`의 메모리 변수에만 저장한다.

### mock 또는 미연결 기능

- 비밀번호 재설정은 `frontend/src/pages/ForgotPasswordPage.tsx`에서 toast 안내만 수행한다.
- 카카오 로그인은 `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/RegisterPage.tsx`에서 준비 중 toast만 수행한다.
- 프로필 사진 업로드 저장은 `frontend/src/pages/MePage.tsx`에서 로컬 미리보기와 준비 중 toast만 수행한다.
- 채팅 이미지 메시지는 DTO/API에 `imageUrl` 필드가 있으나, 채팅 이미지 업로드 엔드포인트와 프론트 업로드 플로우는 확인되지 않는다.
- Toss sandbox 실제 승인/취소와 실제 webhook endpoint 검증 결과는 코드/문서상 자동 테스트 증거가 아니라 provider mock 기반 unit test 중심이다.
- Rate Limit은 `ThrottlerModule` 설정과 환경변수 검증은 있으나, `ThrottlerGuard` 전역 적용 또는 route guard 적용은 확인되지 않는다.
- CSRF token/guard는 확인되지 않는다. 현재 근거는 Bearer access token, refresh cookie `SameSite=Strict`에 머문다.
- e2e 보안 테스트 디렉터리와 실제 DB 기반 동시성 테스트는 확인되지 않는다.

### 보고서 근거로 쓸 수 있는 보안 패치

- IDOR/BOLA: 서비스 레벨 seller/participant/owner 검증이 상품, 채팅, 거래, 결제, 알림, 신고, 사용자 private profile에 적용되어 있다.
- SQL Injection: production 코드에서 `$queryRawUnsafe` 사용은 확인되지 않고, 검색은 Prisma `findMany` 조건으로 구성되어 있다.
- 파일 업로드: 상품 이미지 업로드에서 확장자, 위험 확장자, MIME, 매직바이트, 크기, UUID 파일명을 검증한다.
- 결제 금액 조작: 결제 생성 DTO는 `amount`를 받지 않고, `Transaction.amount`와 `Product.price`를 대조하며 Toss 승인 amount도 DB 결제 금액과 비교한다.
- 관리자 권한 우회: 모든 관리자 컨트롤러는 `JwtAuthGuard`, `RolesGuard`, `@Roles(Role.ADMIN)`를 class level에 적용한다.
- Mass Assignment: 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`와 DTO 테스트가 존재한다.
- 민감정보 노출: `@Exclude()` 방식은 확인되지 않지만, 응답별 Prisma `select`로 `passwordHash`, `email`, `phone`을 공개 응답에서 제외한다.
- Webhook Forgery: Toss webhook raw body 기반 HMAC 검증과 `timingSafeEqual` 비교가 구현되어 있다.

### 보고서 근거가 부족한 부분

- Stored XSS는 React 텍스트 바인딩으로 렌더링하는 근거는 있으나, 서버 저장 전 sanitizer, CSP 세부 정책, 브라우저 기반 XSS e2e 증거는 부족하다.
- 파일 업로드는 상품 이미지 기준으로 강하지만, 채팅 이미지 업로드 FR-20은 실제 업로드 플로우가 부족하다.
- Race Condition은 조건부 update와 transaction 근거는 있으나, 동시 요청 e2e 재현/패치 비교 증거가 부족하다.
- Rate Limit은 설정만 있고 guard 적용이 확인되지 않아 실제 차단 증거로 쓰기 부족하다.
- CSRF는 SameSite/Bearer 구조 외 CSRF token/guard 근거가 없다.
- Toss 실제 외부 연동 결과, webhook 서명 수동 검증 로그, 스크린샷 증거가 아직 부족하다.

### 2차 작업에서 준비해야 할 항목

- 보안 e2e 테스트: BOLA, SQLi payload, XSS 렌더링, 파일 위장 업로드, 결제 amount 변조, 관리자 API 일반 사용자 접근, webhook 서명 불일치, 동시 예약/결제.
- 실행 증거: `npm run test`, `npm run lint`, 백엔드 서버 기동, 주요 API curl 결과, 프론트 화면 스크린샷.
- 보강 구현 후보: CSRF token/guard, 실제 RateLimit guard 적용, 채팅 이미지 업로드, 비밀번호 재설정, 알림 생산자 확대.
- 보고서용 전후 비교 자료: 취약 패턴 재현 브랜치 또는 `VULN_DEMO` 플래그 기준의 공격 요청/응답과 패치 후 요청/응답.

## 2. 기능별 실제 구현 상태

| 기능 영역 | 실제 구현 상태 | mock/미연결 여부 | 주요 파일 | 관련 FR | 관련 SR | 보고서 활용 가능성 |
|---|---|---|---|---|---|---|
| 인증/세션 | 회원가입/로그인/refresh/logout, bcrypt, Redis refresh session, 로그인 실패 잠금, DB status 재확인 `JwtAuthGuard`, refresh cookie 설정, 프론트 access token 메모리 보관 구현 | unit test는 Redis/JWT mock 사용. CSRF token은 없음 | `backend/src/modules/auth/auth.service.ts`, `backend/src/modules/auth/auth.controller.ts`, `backend/src/common/guards/jwt-auth.guard.ts`, `backend/src/common/guards/roles.guard.ts`, `frontend/src/api/client.ts`, `frontend/src/auth/AuthProvider.tsx` | FR-01~06 | SR-01~05, SR-34, SR-39 | 높음. 인증/세션 보안 패치 근거로 사용 가능 |
| 상품 | 상품 CRUD, 검색, 내 상품, 찜, 이미지 업로드 구현. 상품 수정/삭제/상태변경/업로드는 seller 검증 | 상품 이미지 업로드는 연결됨. 프로필 사진 저장과 채팅 이미지 업로드는 별도 미연결 | `backend/src/modules/products/products.service.ts`, `backend/src/modules/products/products.controller.ts`, `backend/src/modules/products/dto/*.ts`, `frontend/src/pages/HomePage.tsx`, `frontend/src/pages/ProductDetailPage.tsx`, `frontend/src/pages/ProductFormPage.tsx` | FR-07~15 | SR-06, SR-11~21, SR-35, SR-39 | 높음. IDOR, SQLi, 파일 업로드, Mass Assignment 근거로 사용 가능 |
| 채팅 | REST 채팅방/메시지 API와 Socket.IO 구현. 참여자만 조회/전송/읽음 가능. WS handshake에서 DB status 재확인 | 채팅 이미지 업로드 플로우는 미확인. 메시지 `imageUrl` 필드만 있음 | `backend/src/modules/chats/chats.service.ts`, `backend/src/modules/chats/chats.controller.ts`, `backend/src/modules/chats/chats.gateway.ts`, `frontend/src/pages/ChatsPage.tsx`, `frontend/src/api/chats.ts` | FR-16~19, FR-21~22. FR-20은 부분 | SR-07, SR-13, SR-34, SR-35, SR-39 | 높음. BOLA, Stored XSS 일부, 민감정보 제거 근거로 사용 가능 |
| 거래 | 거래 요청/예약/취소/완료/목록/상세/후기 구현. 상태 전이는 actor 검증 후 Prisma `$transaction`과 조건부 `updateMany` 사용 | 실제 동시 요청 e2e 증거는 없음 | `backend/src/modules/transactions/transactions.service.ts`, `backend/src/modules/transactions/transactions.controller.ts`, `backend/src/modules/transactions/dto/*.ts`, `frontend/src/pages/TransactionsPage.tsx`, `frontend/src/api/transactions.ts` | FR-23~29 | SR-08, SR-15, SR-26, SR-35, SR-39 | 높음. BOLA, Race Condition 부분, Mass Assignment 근거로 사용 가능 |
| 안전결제 | 결제 생성/승인/webhook/구매확정/환불/영수증 구현. Toss provider가 실제 API 호출 구조를 갖고, unit test는 provider mock 사용 | Toss sandbox 실제 승인/취소 및 외부 webhook 수동 검증 증거는 부족 | `backend/src/modules/payments/payments.service.ts`, `backend/src/modules/payments/payments.controller.ts`, `backend/src/modules/payments/toss-webhook-verifier.ts`, `backend/src/modules/payments/providers/toss-payments.provider.ts`, `frontend/src/api/payments.ts`, `frontend/src/pages/TransactionsPage.tsx` | FR-30~38 | SR-22~28, SR-30, SR-35, SR-39 | 높음. Price Tampering, Webhook Forgery, BOLA 근거로 사용 가능 |
| 신고/관리자 | 신고 생성/내 신고, 관리자 신고/상품/사용자/로그 API 구현. 관리자 컨트롤러 class level에 `JwtAuthGuard + RolesGuard + @Roles(ADMIN)` 적용 | 관리자 기능은 프론트 API 연결됨. CSRF token은 없음 | `backend/src/modules/reports/reports.service.ts`, `backend/src/modules/admin/admin.service.ts`, `backend/src/modules/admin/*controller.ts`, `frontend/src/pages/AdminPages.tsx`, `frontend/src/api/admin.ts`, `frontend/src/pages/ReportsPage.tsx` | FR-39~46 | SR-05, SR-09, SR-15, SR-28, SR-36, SR-39 | 높음. 관리자 권한 우회, Mass Assignment, 민감정보 제거 근거로 사용 가능 |
| 알림 | 내 알림 목록과 읽음 처리 구현. `ChatsService`에서 새 메시지 알림 생성 확인 | 거래/신고/관심 상품 알림 생산자는 전체 구현 근거 부족 | `backend/src/modules/notifications/notifications.service.ts`, `backend/src/modules/notifications/notifications.controller.ts`, `backend/src/modules/chats/chats.service.ts`, `frontend/src/pages/NotificationsPage.tsx`, `frontend/src/api/notifications.ts` | FR-47 일부, FR-48~50은 부분/확인필요 | SR-35, SR-39 | 중간. 알림 IDOR 방어 근거는 사용 가능, 전체 알림 기능 근거는 제한 |
| 프론트 UI/API 연결 | 상품, 채팅, 거래, 결제, 신고, 관리자, 알림, 차단, 내 정보 화면이 API client와 연결됨. 사용자 입력은 React 텍스트 바인딩으로 렌더링 | 비밀번호 재설정, 카카오 로그인, 프로필 사진 저장은 준비 상태. `PlaceholderPage`/`AdminHomePage` 미사용 placeholder 코드 존재 | `frontend/src/App.tsx`, `frontend/src/api/*.ts`, `frontend/src/pages/*.tsx`, `frontend/src/routes/*.tsx` | 전반 | SR-03, SR-13, SR-34, SR-39 | 중간. 실제 API 연결 증거와 mock 제외 근거로 사용 가능 |

## 3. 취약점별 현재 패치 상태

| 취약점 | 현재 상태 | 패치 근거 파일 | 테스트 존재 여부 | 보고서 활용 가능성 | 보완 필요사항 |
|---|---|---|---|---|---|
| IDOR / BOLA | 완료 | `products.service.ts`, `chats.service.ts`, `transactions.service.ts`, `payments.service.ts`, `notifications.service.ts`, `reports.service.ts`, `users.service.ts` | 있음: 각 service/controller spec에서 비소유자/비참여자 차단, current user 기준 조회 검증 | 높음 | e2e에서 타 사용자 토큰으로 실제 API 호출 증거 추가 |
| Stored XSS | 부분완료 | `frontend/src/pages/ProductDetailPage.tsx`, `frontend/src/pages/ChatsPage.tsx`, `frontend/src/pages/AdminPages.tsx`, DTO length/trim 파일들 | 일부 있음: 채팅 메시지 응답에 `dangerouslySetInnerHTML` 미포함 검증. 브라우저 XSS e2e는 없음 | 중간 | XSS payload 저장 후 렌더링 e2e, 서버 sanitizer 적용 여부 결정, CSP 검증 |
| SQL Injection | 완료 | `products.service.ts`, `admin.service.ts`, production 코드 전역 `$queryRawUnsafe` 미사용 | 있음: 여러 service spec에서 `$queryRawUnsafe` 미호출 검증 | 높음 | 검색 API에 SQLi payload e2e 추가 |
| 파일 업로드 취약점 | 부분완료 | `products.service.ts`, `products.controller.ts`, `main.ts`, `configuration.ts` | 있음: UUID 파일명, double extension PHP 위장, MIME/magic-byte mismatch 테스트 | 높음 | 채팅 이미지 업로드 구현/검증, 실제 multipart e2e, 실행불가 저장 경로 운영 증거 |
| 결제 금액 조작 | 완료 | `payments.service.ts`, `payments/dto/create-payment.dto.ts`, `transactions.service.ts`, `schema.prisma` | 있음: amount mismatch, idempotency, buyer 검증 테스트 | 높음 | 실제 Toss sandbox 승인 요청/응답 캡처 |
| 관리자 권한 우회 | 완료 | `admin/*controller.ts`, `jwt-auth.guard.ts`, `roles.guard.ts`, `auth/dto/*.ts`, `users/dto/update-me.dto.ts` | 있음: admin controller guard/role metadata, RolesGuard, JwtAuthGuard DB role/status 테스트, DTO injection 테스트 | 높음 | 일반 사용자 토큰으로 `/api/admin/*` e2e 403 증거 |
| CSRF | 부분완료 | `auth.controller.ts`, `frontend/src/api/client.ts`, `main.ts` CORS credentials | 있음: refresh cookie `httpOnly`, `sameSite: strict` controller 테스트 | 낮음 | CSRF token/guard 미구현. 쿠키 기반 state-changing API 범위 재검토와 CSRF e2e 필요 |
| Race Condition | 부분완료 | `transactions.service.ts`, `payments.service.ts`, `schema.prisma` unique 제약 | 일부 있음: 조건부 `updateMany`, transaction 상태 변경 테스트 | 중간 | 동시 예약/결제 e2e 또는 integration test로 1건만 성공 증명 |
| Mass Assignment | 완료 | `main.ts`, 각 DTO 파일, `schema.prisma` DTO policy comment | 있음: auth/product/chat/transaction/payment/report/admin/notification/block/user DTO injection 테스트 | 높음 | 실제 HTTP request에서 초과 필드 400 처리 e2e 추가 |
| Rate Limit | 부분완료 | `app.module.ts`, `env.validation.ts`, `configuration.ts`, `package.json` | 일부 있음: AppModule compile과 env 검증 경로. 실제 guard 차단 테스트 없음 | 낮음 | `ThrottlerGuard` 전역/route 적용 및 429 테스트 필요 |
| 민감정보 노출 | 완료 | 응답별 `Prisma select`: `users.service.ts`, `products.service.ts`, `chats.service.ts`, `transactions.service.ts`, `payments.service.ts`, `admin.service.ts`, `notifications.service.ts` | 있음: passwordHash/email/phone 미노출 테스트 다수 | 높음 | e2e 응답 본문에서 민감 필드 부재 캡처 |
| Webhook Forgery | 완료 | `payments.controller.ts`, `payments.service.ts`, `toss-webhook-verifier.ts` | 있음: 유효 HMAC 수락, 잘못된 signature 거부, invalid webhook이 payment state를 건드리지 않는 테스트 | 높음 | 실제 raw body webhook 요청/응답 로그와 timestamp replay 정책 검토 |

## 4. 보안 패치 증거 후보

### IDOR / BOLA

- 관련 요구사항 ID: FR-09, FR-18, FR-27, FR-30, FR-37, FR-43~46, FR-47; SR-06, SR-07, SR-08, SR-10, SR-30, SR-35, SR-36.
- 관련 파일: `backend/src/modules/products/products.service.ts`, `backend/src/modules/chats/chats.service.ts`, `backend/src/modules/transactions/transactions.service.ts`, `backend/src/modules/payments/payments.service.ts`, `backend/src/modules/notifications/notifications.service.ts`, `backend/src/modules/reports/reports.service.ts`, `backend/src/modules/users/users.service.ts`.
- 확인된 안전 코드: `assertProductSeller`, `assertParticipant`, `assertBuyer`, `getTransactionForParticipant`, `markAsRead(userId, notificationId)`의 `{ id, userId }` 조건, private profile의 본인/ADMIN 검사.
- 취약했을 가능성이 있는 패턴: `findUnique({ where: { id } })` 결과를 현재 사용자 검증 없이 반환하는 패턴. 현재 주요 객체 API에서는 확인되지 않는다.
- 보고서에 쓸 수 있는 설명: 객체 ID를 URL에서 받더라도 서버가 토큰 subject와 DB의 seller/buyer/participant/userId를 대조한다. 타인 객체는 403 또는 존재하지 않는 것처럼 404로 처리해 직접 객체 참조 공격을 막는다.
- 추가로 필요한 테스트: 실제 HTTP e2e에서 사용자 A 토큰으로 사용자 B의 채팅/거래/결제 영수증/알림을 조회하고 403 또는 404가 반환되는지 캡처.

### Stored XSS

- 관련 요구사항 ID: FR-07, FR-13, FR-17; SR-13.
- 관련 파일: `frontend/src/pages/ProductDetailPage.tsx`, `frontend/src/pages/ChatsPage.tsx`, `frontend/src/pages/AdminPages.tsx`, `frontend/src/pages/ReportsPage.tsx`, `backend/src/modules/products/dto/create-product.dto.ts`, `backend/src/modules/chats/dto/send-message.dto.ts`.
- 확인된 안전 코드: 상품 설명, 채팅 메시지, 신고 설명, 관리자 상세 설명을 `<p>{value}</p>` 형태의 React 텍스트 바인딩으로 렌더링한다. `dangerouslySetInnerHTML`, `innerHTML`, `DOMPurify` 사용은 production 프론트에서 확인되지 않는다.
- 취약했을 가능성이 있는 패턴: 사용자 입력을 `dangerouslySetInnerHTML`이나 직접 DOM 삽입으로 렌더링하는 패턴. 현재 검색에서는 발견되지 않는다.
- 보고서에 쓸 수 있는 설명: 프론트는 HTML 문자열을 HTML로 주입하지 않고 React escaping 경로로 렌더링한다. 따라서 저장된 `<script>` 또는 이벤트 핸들러 문자열은 텍스트로 표시되는 방향이다.
- 추가로 필요한 테스트: 상품 설명과 채팅 메시지에 `<img src=x onerror=alert(1)>`를 저장한 뒤 Playwright에서 alert 미발생과 텍스트 표시를 검증. 서버 저장 전 sanitizer 적용 여부는 2차에서 결정.

### SQL Injection

- 관련 요구사항 ID: FR-13; SR-12.
- 관련 파일: `backend/src/modules/products/products.service.ts`, `backend/src/modules/admin/admin.service.ts`, `backend/prisma/schema.prisma`.
- 확인된 안전 코드: 상품 검색과 관리자 검색은 Prisma `findMany`의 `where.OR`, `contains`, `mode: 'insensitive'` 조건을 사용한다. production 코드에서 `$queryRawUnsafe` 사용은 확인되지 않는다.
- 취약했을 가능성이 있는 패턴: 검색어를 SQL 문자열에 직접 보간해 `$queryRawUnsafe`로 실행하는 패턴. 현재 production 코드에서는 확인되지 않는다.
- 보고서에 쓸 수 있는 설명: 사용자가 입력한 검색어는 ORM 조건 객체로 전달되어 쿼리 문자열 조립에 직접 사용되지 않는다. SQLi 시연 페이로드는 일반 검색 문자열로 처리된다.
- 추가로 필요한 테스트: `/api/products/search?q=' OR '1'='1` 요청이 전체 데이터 우회 노출로 이어지지 않는 e2e와 `$queryRawUnsafe` 정적 검색 결과 캡처.

### 파일 업로드 취약점

- 관련 요구사항 ID: FR-08, FR-20; SR-16~SR-21.
- 관련 파일: `backend/src/main.ts`, `backend/src/modules/products/products.controller.ts`, `backend/src/modules/products/products.service.ts`, `backend/src/config/configuration.ts`.
- 확인된 안전 코드: Fastify multipart `fileSize` 제한, field 거부, service 레벨 파일 개수 제한, 빈 파일 거부, 위험 확장자 차단, jpg/jpeg/png/webp 확장자 허용, MIME allowlist, JPEG/PNG/WebP 매직바이트 직접 검사, MIME/확장자/시그니처 대조, UUID 파일명 저장.
- 취약했을 가능성이 있는 패턴: 원본 파일명 그대로 저장, MIME만 신뢰, `shell.php.jpg` 허용, SVG/HTML/PHP 업로드 허용, 웹 루트 실행 가능 경로 저장.
- 보고서에 쓸 수 있는 설명: 상품 이미지 업로드는 클라이언트가 제공한 파일명과 MIME만 신뢰하지 않고, 서버에서 확장자와 실제 파일 시그니처를 대조한 뒤 UUID 파일명으로 저장한다.
- 추가로 필요한 테스트: 실제 multipart e2e에서 `shell.php.jpg`, SVG, HTML, MIME mismatch 파일 거부 확인. 채팅 이미지 업로드는 현재 미구현이므로 구현 또는 범위 제외 결정 필요.

### 결제 금액 조작

- 관련 요구사항 ID: FR-30, FR-31, FR-32, FR-38; SR-22, SR-23, SR-24.
- 관련 파일: `backend/src/modules/payments/dto/create-payment.dto.ts`, `backend/src/modules/payments/payments.service.ts`, `backend/src/modules/transactions/transactions.service.ts`, `backend/prisma/schema.prisma`.
- 확인된 안전 코드: `CreatePaymentDto`는 `transactionId`, `idempotencyKey`만 받는다. 거래 생성 시 `amount`는 `product.price`에서 저장된다. 결제 생성은 `transaction.amount !== transaction.product.price`를 충돌로 처리한다. Toss 승인 요청의 `amount`와 provider 응답의 `amount`도 DB payment amount와 대조한다.
- 취약했을 가능성이 있는 패턴: 클라이언트 body의 `amount`나 `price`를 결제 금액으로 신뢰하는 패턴. 현재 결제 생성 DTO에는 없다.
- 보고서에 쓸 수 있는 설명: 공격자가 결제 요청 body에 `amount: 100`을 추가해도 DTO whitelist에서 거부되며, 서버는 거래와 상품 DB 가격을 기준으로 결제 금액을 확정한다.
- 추가로 필요한 테스트: HTTP e2e에서 `POST /api/payments`에 `amount`, `userId`, `status`를 주입해 400 또는 무시가 아니라 forbidNonWhitelisted 정책대로 거부되는지 확인. Toss sandbox 승인 캡처 추가.

### 관리자 권한 우회

- 관련 요구사항 ID: FR-42~46; SR-05, SR-09, SR-15, SR-36.
- 관련 파일: `backend/src/modules/admin/admin-users.controller.ts`, `backend/src/modules/admin/admin-products.controller.ts`, `backend/src/modules/admin/admin-reports.controller.ts`, `backend/src/modules/admin/admin-logs.controller.ts`, `backend/src/common/guards/jwt-auth.guard.ts`, `backend/src/common/guards/roles.guard.ts`.
- 확인된 안전 코드: 관리자 컨트롤러 class에 `@UseGuards(JwtAuthGuard, RolesGuard)`와 `@Roles(Role.ADMIN)`가 적용되어 있다. `JwtAuthGuard`는 JWT payload role을 그대로 믿지 않고 DB의 `id/email/role/status`를 재조회한다. `RolesGuard`는 ADMIN role뿐 아니라 `UserStatus.ACTIVE`를 요구한다.
- 취약했을 가능성이 있는 패턴: URL 직접 호출만으로 admin API 접근, JWT payload의 stale role 신뢰, 회원가입/프로필 수정 body의 `role: "ADMIN"` 신뢰.
- 보고서에 쓸 수 있는 설명: 권한 판단은 클라이언트 입력이 아니라 DB role/status를 기준으로 한다. 정지된 관리자나 일반 사용자는 관리자 API에 접근할 수 없다.
- 추가로 필요한 테스트: 일반 USER, SUSPENDED ADMIN, ACTIVE ADMIN 세 토큰으로 관리자 API 호출 결과를 e2e로 캡처.

### CSRF

- 관련 요구사항 ID: SR-03, SR-38. `docs/security-spec.md`는 CSRF Token + SameSite를 추가 분석 대상으로 제시한다.
- 관련 파일: `backend/src/modules/auth/auth.controller.ts`, `frontend/src/api/client.ts`, `backend/src/main.ts`.
- 확인된 안전 코드: refresh token cookie는 `httpOnly: true`, `sameSite: 'strict'`, production secure 설정을 사용한다. access token은 localStorage가 아니라 메모리에 저장하고 API 요청은 `Authorization: Bearer` 헤더를 사용한다. CORS는 허용 origin과 credentials를 설정한다.
- 취약했을 가능성이 있는 패턴: 쿠키만으로 인증되는 상태 변경 API, CSRF token 없이 cross-site form POST가 성공하는 패턴.
- 보고서에 쓸 수 있는 설명: 일반 API는 Bearer access token이 필요해 단순 CSRF form으로 Authorization 헤더를 만들 수 없다. 다만 refresh/logout처럼 cookie를 쓰는 auth endpoint와 관리자 상태 변경 API에 대한 명시적 CSRF token/guard는 아직 확인되지 않는다.
- 추가로 필요한 테스트: cross-origin form/fetch 시나리오에서 state-changing API가 차단되는지 검증. CSRF token 도입 여부 결정.

### Race Condition

- 관련 요구사항 ID: FR-23~27, FR-30~36; SR-08, SR-24, SR-26, SR-27.
- 관련 파일: `backend/src/modules/transactions/transactions.service.ts`, `backend/src/modules/payments/payments.service.ts`, `backend/prisma/schema.prisma`.
- 확인된 안전 코드: 예약/취소/완료/구매확정은 Prisma `$transaction` 안에서 현재 상태를 확인하고 `updateMany` 조건부 count를 검사한다. `Payment.transactionId`, `Payment.idempotencyKey`, `Payment.orderId`는 unique 제약이 있다.
- 취약했을 가능성이 있는 패턴: 읽기 후 무조건 update, 상태 count 확인 없음, 같은 상품에 여러 RESERVED/PAID 거래 허용, 같은 결제 idempotency 중복 생성.
- 보고서에 쓸 수 있는 설명: 상태 변경은 DB transaction과 조건부 update를 통해 이미 변경된 상태를 감지하면 409로 거부하는 구조다. 중복 결제는 unique key와 idempotency 처리로 방어한다.
- 추가로 필요한 테스트: 동일 상품에 대한 동시 예약 요청 2건, 동일 transaction에 대한 다른 idempotency key 결제 요청 2건을 실제 DB integration/e2e로 실행해 한 건만 성공함을 증명.

### Mass Assignment

- 관련 요구사항 ID: SR-15, SR-22, SR-36.
- 관련 파일: `backend/src/main.ts`, `backend/src/modules/*/dto/*.ts`, `backend/prisma/schema.prisma`.
- 확인된 안전 코드: 전역 `ValidationPipe`가 `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`로 설정되어 있다. DTO에는 `role`, `sellerId`, `buyerId`, `reporterId`, `adminId`, 결제 생성 `amount/status/userId` 같은 권한 필드가 없다.
- 취약했을 가능성이 있는 패턴: DTO 없이 raw body를 DB create/update에 spread, `role`, `status`, `sellerId`, `amount`를 body에서 받아 저장.
- 보고서에 쓸 수 있는 설명: 클라이언트가 권한/상태 필드를 주입하면 whitelist 정책과 DTO 부재로 거부되며, 서비스는 인증 사용자와 DB 상태에서 필드를 파생한다.
- 추가로 필요한 테스트: 각 핵심 HTTP endpoint에서 초과 필드가 400 처리되는 e2e 캡처.

### Rate Limit

- 관련 요구사항 ID: SR-02, SR-37.
- 관련 파일: `backend/src/app.module.ts`, `backend/src/config/configuration.ts`, `backend/src/config/env.validation.ts`, `backend/src/modules/auth/auth.service.ts`, `backend/src/modules/redis/redis.service.ts`.
- 확인된 안전 코드: `ThrottlerModule.forRootAsync` 설정과 `RATE_LIMIT_WINDOW`, `RATE_LIMIT_MAX` 환경변수 검증이 있다. 로그인 실패 잠금은 Redis counter와 `lockedUntil` 업데이트로 구현되어 있다.
- 취약했을 가능성이 있는 패턴: 로그인/결제/채팅 API에 요청 횟수 제한이 전혀 없는 패턴. 현재 로그인 실패 잠금은 있으나 Nest Throttler guard 적용은 확인되지 않는다.
- 보고서에 쓸 수 있는 설명: 계정 단위 로그인 실패 잠금은 구현되어 있으나, API 요청 rate limit은 설정만 있고 실제 guard 연결 근거가 부족하므로 완료로 보기 어렵다.
- 추가로 필요한 테스트: `ThrottlerGuard` 적용 후 로그인/결제/채팅 API에 반복 요청을 보내 429를 확인. 현재 상태에서는 guard 적용 여부를 먼저 보강해야 한다.

### 민감정보 노출

- 관련 요구사항 ID: NFR-05, SR-29, SR-30, SR-31, SR-39.
- 관련 파일: `backend/src/modules/users/users.service.ts`, `backend/src/modules/products/products.service.ts`, `backend/src/modules/chats/chats.service.ts`, `backend/src/modules/transactions/transactions.service.ts`, `backend/src/modules/payments/payments.service.ts`, `backend/src/modules/admin/admin.service.ts`, `backend/src/modules/notifications/notifications.service.ts`.
- 확인된 안전 코드: `PUBLIC_USER_SELECT`, `PUBLIC_SELLER_SELECT`, `PAYMENT_RESPONSE_SELECT`, `NOTIFICATION_RESPONSE_SELECT` 등 응답별 Prisma `select`로 공개 필드만 선택한다. 공개 상품/채팅/거래/결제/관리자 로그 응답에서 `passwordHash`, `email`, `phone`을 선택하지 않는다.
- 취약했을 가능성이 있는 패턴: `include: { user: true }`, `select` 없는 사용자 relation 반환, admin 로그에 token/secret/password 저장.
- 보고서에 쓸 수 있는 설명: 이 프로젝트는 `@Exclude()` 직렬화보다 DB 조회 단계의 명시적 `select`로 민감정보가 응답 객체에 들어오지 않게 한다. 테스트도 반환 객체에 민감 필드가 없음을 검증한다.
- 추가로 필요한 테스트: 실제 API 응답 JSON에서 `passwordHash`, `phone`, secret, token 문자열이 없는지 e2e와 정적 grep 결과를 캡처.

### Webhook Forgery

- 관련 요구사항 ID: FR-38; SR-23, SR-24.
- 관련 파일: `backend/src/modules/payments/payments.controller.ts`, `backend/src/modules/payments/payments.service.ts`, `backend/src/modules/payments/toss-webhook-verifier.ts`.
- 확인된 안전 코드: `TossWebhookVerifier`가 `timestamp.rawBody`를 HMAC-SHA256으로 서명하고 `timingSafeEqual`로 비교한다. signature 또는 timestamp가 없거나 secret이 없으면 실패한다. webhook 처리 후에도 orderId/paymentKey로 DB Payment를 찾고 amount mismatch를 거부한다.
- 취약했을 가능성이 있는 패턴: 공개 `/payments/webhook` endpoint에서 body의 `status: DONE`만 믿고 결제 완료 처리, HMAC 검증 없음, amount 대조 없음.
- 보고서에 쓸 수 있는 설명: webhook endpoint는 공개이지만 신뢰 경계 밖 입력으로 보고 raw body 서명 검증을 통과한 요청만 상태 반영한다. payload amount도 DB payment amount와 대조한다.
- 추가로 필요한 테스트: 잘못된 signature, 누락 signature, amount mismatch, 중복 DONE webhook을 HTTP e2e로 검증. timestamp replay 제한 정책 검토.

## 5. mock/미연결 기능 목록

| 영역 | 파일 | 현재 상태 | 왜 보고서 근거로 부족한지 | 2차 작업 필요사항 |
|---|---|---|---|---|
| 비밀번호 재설정 | `frontend/src/pages/ForgotPasswordPage.tsx` | form 제출 시 준비 중 toast만 표시. 입력 이메일은 저장/전송하지 않음 | SR-32 비밀번호 재설정 토큰 만료 요구사항의 실제 구현 근거가 아님 | reset token 발급/저장/만료/메일 전송 또는 범위 제외 명시 |
| 카카오 로그인 | `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/RegisterPage.tsx` | 버튼 클릭 시 준비 중 toast | 실제 OAuth 인증 기능이 아니므로 인증 보안 근거로 사용 불가 | 기능 제외 또는 OAuth flow 구현 후 보안 검증 |
| 프로필 사진 업로드 저장 | `frontend/src/pages/MePage.tsx` | 파일 선택 시 로컬 preview와 준비 중 toast. 서버 저장 없음 | 파일 업로드 보안 패치 근거는 상품 이미지에만 한정됨 | 사용자 avatar 업로드 endpoint 또는 `avatarUrl` URL 입력 정책 정리 |
| 채팅 이미지 업로드 | `backend/src/modules/chats/dto/send-message.dto.ts`, `frontend/src/pages/ChatsPage.tsx` | 메시지에 `imageUrl` 필드는 있으나 이미지 업로드 플로우는 확인되지 않음 | FR-20과 SR-16~21의 채팅 이미지 근거로 부족 | 상품 업로드 검증 로직 재사용 또는 채팅 이미지 범위 제외 |
| 알림 생산자 전체 | `backend/src/modules/notifications/notifications.service.ts`, `backend/src/modules/chats/chats.service.ts` | 목록/읽음 API와 채팅 알림 생성은 확인. 거래/신고/관심 상품 알림 생산자는 근거 부족 | FR-48~50 전체 구현 증거로 부족 | 거래 상태 변경, 신고 처리, 찜 상품 이벤트별 알림 생성 테스트 추가 |
| Rate Limit 실제 적용 | `backend/src/app.module.ts`, `backend/src/config/env.validation.ts` | `ThrottlerModule` 설정은 있으나 `ThrottlerGuard` 적용 확인 안 됨 | SR-37 차단 근거로 부족. 설정만으로 요청 제한이 동작한다고 볼 수 없음 | 전역 또는 route guard 적용, 429 테스트 추가 |
| CSRF token/guard | `backend/src/modules/auth/auth.controller.ts`, `frontend/src/api/client.ts` | SameSite refresh cookie와 Bearer access token 구조는 있으나 CSRF token 없음 | `docs/security-spec.md`의 CSRF Token + SameSite 요구를 완전히 충족하지 못함 | CSRF 적용 범위 결정, token 발급/검증 또는 명시적 제외 근거 작성 |
| e2e 보안 테스트 | `backend/src/**/*.spec.ts` | unit/controller/DTO spec 중심. `backend/test/e2e`, 루트 `test` 미확인 | 최종 보고서 전후 비교의 실행 증거로 부족 | 핵심 보안 시나리오 e2e 추가 |
| Toss sandbox 실결제 증거 | `backend/src/modules/payments/providers/toss-payments.provider.ts`, `frontend/src/pages/TransactionsPage.tsx` | 실제 API 호출 코드는 있으나 자동 테스트는 provider mock 중심 | 외부 PG 연동 성공/실패/웹훅 검증 스크린샷 근거 부족 | test key로 sandbox 승인/취소/webhook 수동 또는 자동 검증 캡처 |
| 미사용 placeholder 컴포넌트 | `frontend/src/pages/PlaceholderPage.tsx` | `PlaceholderPage`, `AdminHomePage` 준비 화면 코드가 남아 있음. 현재 `App.tsx` 라우트는 `AdminPages.tsx` 사용 | 실제 기능 근거가 아니라 과거/예비 UI 코드일 가능성 | 미사용 여부 확인 후 유지 사유 문서화 또는 2차 정리 |

## 6. 2차 작업 제안

### 최종 보고서 작성 전 준비해야 할 문서

- 취약점별 전후 비교 표: 취약 요청, 패치 전 예상 결과, 패치 후 실제 결과, 관련 FR/SR, 증거 파일.
- API 보안 테스트 실행 로그: 요청 URL, method, actor, payload, expected status, actual status.
- 정적 분석 근거: `$queryRawUnsafe`, `dangerouslySetInnerHTML`, `localStorage`, `sessionStorage`, `ThrottlerGuard`, CSRF 관련 검색 결과.
- 보안 패치 매핑표: 요구사항 ID, 구현 파일, 테스트 파일, 스크린샷/로그 위치.
- 범위 제외/부분완료 사유서: 비밀번호 재설정, OAuth, 채팅 이미지, 일부 알림 생산자, Toss 실연동.

### 추가해야 할 테스트

- IDOR/BOLA e2e: 타인 채팅방, 거래 상세, 결제 영수증, 알림 읽음, private profile 접근 차단.
- Stored XSS e2e: 상품 설명, 채팅 메시지, 신고 설명에 XSS payload 저장 후 렌더링 시 alert 미발생.
- SQL Injection e2e: 검색어 SQLi payload가 권한 우회/전체 노출로 이어지지 않음.
- 파일 업로드 e2e: 정상 jpg/png/webp 성공, PHP double extension/SVG/HTML/MIME mismatch/초과 크기 거부.
- Price Tampering e2e: `amount`, `price`, `userId`, `status` 주입 결제 요청 거부와 서버 가격 유지.
- 관리자 권한 e2e: USER, SUSPENDED ADMIN, ACTIVE ADMIN의 `/api/admin/*` 접근 결과 비교.
- CSRF/Rate Limit e2e: cross-site 시나리오와 반복 요청 429 결과.
- Race Condition integration: 동일 상품 동시 예약/구매, 동일 결제 idempotency 중복 요청.
- Webhook Forgery e2e: signature 누락/불일치/amount mismatch/중복 webhook.

### 실제 구현 보강이 필요한 기능

- `ThrottlerGuard` 전역 또는 핵심 route 적용.
- CSRF token/guard 적용 또는 Bearer-only 구조 기준의 명확한 위험 수용 문서화.
- 채팅 이미지 업로드 기능을 상품 업로드와 동일 수준으로 검증.
- 비밀번호 재설정 token 만료/재사용 방지 구현.
- 거래/신고/관심 상품 알림 생산자 추가.
- Toss sandbox 환경변수와 webhook endpoint 검증 절차 정리.

### 스크린샷이나 실행 결과로 남겨야 할 증거

- `git branch --show-current`, `git status --short`.
- `cd backend && npm run test`, `cd backend && npm run lint`, `cd frontend && npm run build` 또는 `npm run lint`.
- Postman/curl 결과: BOLA 차단, admin 403, amount tampering 400/409, webhook invalid signature 401, file upload 거부.
- 프론트 화면: 상품 상세 XSS payload 텍스트 렌더링, 거래/결제 진행, 관리자 콘솔 접근 제어, 알림 목록 본인 데이터만 표시.
- DB 확인: `Payment.amount`, `Transaction.amount`, `Product.price`, `Payment.idempotencyKey`, `AdminLog`, `AuditLog`.
