# 개발 로그

## 2026-06-28 / branch: chore/seed-admin-demo-data

### 프론트/최종 시연용 dev seed 데이터 보강

- 구현 기능:
  - 기존 `seller@example.com`, `buyer@example.com`, `admin@example.com` 계정을 유지하고 `suspended@example.com`, `banned@example.com`, `secondbuyer@example.com`, `secondseller@example.com` seed 계정을 추가했다.
  - 상품 seed를 `ON_SALE`, `RESERVED`, `SOLD`, `HIDDEN`, 신고/이미지/검색 키워드 시연용으로 확장했다.
  - buyer/seller, secondbuyer/seller 채팅방과 메시지를 추가하고, CHAT 신고 대상 메시지를 실제 `ChatMessage.id`로 연결했다.
  - `REQUESTED`, `RESERVED`, `PAYMENT_PENDING`, `PAID`, `COMPLETED`, `CANCELLED`, `REFUNDED` 거래와 `PENDING`, `PAID`, `REFUNDED` payment seed를 추가했다.
  - `USER`, `PRODUCT`, `CHAT` report와 `PENDING`, `REVIEWING`, `RESOLVED`, `REJECTED` 상태, Block, Notification, AdminLog 시연 데이터를 추가했다.
- 보안/운영 기준:
  - 서비스/API/보안 정책/schema는 변경하지 않고 `backend/prisma/seed.ts`만 보강했다.
  - 실제 Toss secret/key, refresh token, 실제 결제 키, passwordHash 출력은 추가하지 않았다.
  - unique 제약이 있는 데이터는 upsert, unique 제약이 없는 메시지/알림/AdminLog는 seed 전용 식별 조건의 find/update/create 방식으로 반복 실행 중복을 방지했다.
- 문서:
  - `README.md`, `docs/test-checklist.md`, `docs/report-notes.md`, `docs/security-review-log.md` 갱신.
- 검증 결과:
  - `npm install`: 통과, 취약 패키지 0건.
  - `npx prisma validate`: 통과. Prisma 7 예정 deprecation warning(`package.json#prisma`)만 표시.
  - `npm run lint`: 통과.
  - `npm run test`: 통과. 33 files / 231 tests.
  - `npm run build`: 통과.
  - `docker compose config`: 통과.
  - `docker compose up -d`: 통과. Postgres/Redis running.
  - `npx prisma migrate status`: database schema up to date.
  - `npm run db:seed` 2회 연속 실행: 통과. seed summary는 users=8, products=11, chats=2, transactions=7, payments=4, reports=5, blocks=3, notifications=4, adminLogs=6.
  - DB 요약 확인: 상태별 거래 7종, payment `PENDING/PAID/REFUNDED` 및 `escrowReleased=false/true`, CHAT report 참여자/상대 메시지 조건 확인.
  - `rg '\$queryRawUnsafe|\$queryRaw' backend/src backend/prisma`: production 코드 사용 없음. spec mock과 미호출 검증만 확인.
  - `rg 'TOSS_SECRET|SECRET_KEY|sk_live|passwordHash.*console|refreshToken' backend/prisma backend/src`: seed 내 민감정보/실제 결제키/비밀번호 hash 출력 없음. 기존 env validation과 auth refresh token 코드만 확인.
  - `git diff --check`: 통과.
- 커밋:
  - 사용자 요청에 따라 커밋하지 않았다.

## 2026-06-28 / branch: feat/notifications-api

### Notifications API 및 프론트 전 백엔드 보완

- 구현 기능:
  - `GET /api/notifications`: 인증 사용자 본인 알림만 pagination 조회, `unreadOnly=true` 필터 지원.
  - `POST /api/notifications/:id/read`: 본인 알림만 읽음 처리, 타인/없는 알림 id는 404, 이미 읽은 알림은 idempotent 반환.
  - 알림 응답은 `id`, `type`, `title`, `message/body`, `isRead`, `createdAt`, `target`만 반환한다.
  - `GET /api/users/:id`에 `ParseUUIDPipe`를 적용해 비UUID 요청을 400으로 처리한다.
  - `ReportType.CHAT` 신고를 구현했다. `targetId`는 `ChatMessage.id`이며 채팅 참여자만 상대 메시지를 신고할 수 있다.
  - 관리자 신고 상세의 CHAT target summary에 메시지/발신자/채팅/상품 요약을 추가했다.
  - 채팅 메시지 알림 생성 시 `targetType=CHAT`, `targetId=chat.id`를 저장한다.
- DB 변경:
  - `Notification.targetType`, `Notification.targetId`, `@@index([targetType, targetId])` 추가.
  - `Product @@index([sellerId])` 추가.
  - migration `20260628110000_add_notifications_targets_and_product_seller_index` 추가.
- 문서:
  - `README.md`, `docs/api-spec.md`, `docs/test-checklist.md`, `docs/report-notes.md`, `docs/security-review-log.md`, `docs/database-design.md` 갱신.
- 테스트:
  - RED 확인: 신규 notification 파일 미존재, CHAT report 거부, public profile UUID pipe 부재로 targeted test 실패 확인.
  - GREEN 확인: targeted test 통과. 6 files / 29 tests.
  - 전체 테스트: `npm run test` 통과. 33 files / 231 tests.
- 검증 결과:
  - `npm install`: 통과, 취약 패키지 0건.
  - `npx prisma validate`: 통과. Prisma 7 예정 deprecation warning(`package.json#prisma`)만 표시.
  - `npm run lint`: 통과.
  - `npm run test`: 통과. 33 files / 231 tests.
  - `npm run build`: 통과.
  - `timeout 8s npm run start`: Nest application successfully started 확인, `/api/notifications`와 `/api/notifications/:id/read` route 매핑 확인 후 timeout 종료.
  - `docker compose config`: 통과.
  - `docker compose up -d`: 통과. Postgres/Redis running 및 healthy.
  - `npx prisma migrate status`: 신규 migration pending 확인.
  - `npx prisma migrate deploy`: 신규 migration 적용 통과.
  - `npx prisma migrate status`: 최종 database schema up to date.
  - `npm run db:seed`: 통과.
  - `rg '\$queryRawUnsafe|\$queryRaw' backend/src`: production 코드 사용 없음. spec mock과 미호출 검증만 확인.
  - `rg 'passwordHash|refreshToken|TOSS_SECRET|SECRET_KEY' backend/src/modules backend/src/common`: auth password/refresh 처리와 민감정보 미노출 테스트만 확인, Toss secret/key 하드코딩 없음.
  - `git diff --check`: 통과.
- 커밋:
  - TDD RED 테스트 checkpoint, GREEN 구현 checkpoint, 문서/검증 기록 checkpoint를 생성했다.

## 2026-06-28 / branch: fix/session-status-guard

### 정지 사용자 기존 accessToken 재사용 보안 패치

- 구현 기능:
  - `JwtAuthGuard`가 JWT payload를 `sub` 식별 힌트로만 사용하고, DB에서 `User.id/email/role/status`를 재조회하도록 변경했다.
  - `User.status !== ACTIVE`이면 기존 accessToken이 만료되지 않았더라도 HTTP API 요청을 401로 거부한다.
  - `request.user`는 JWT payload의 `email/role`이 아니라 DB 조회 결과로 채운다.
  - `RolesGuard`가 `role`뿐 아니라 `status=ACTIVE`도 요구하도록 변경했다. `role=ADMIN`이어도 `SUSPENDED`이면 관리자 API는 403이다.
  - `ChatsGateway`가 WebSocket 연결 시 token `sub` 기준으로 DB User를 재조회하고 inactive user는 `disconnect(true)` 처리한다.
  - `ReportsService`가 신고 생성 초입에서 reporter ACTIVE 여부를 확인하고 정지 사용자의 신고 생성을 403으로 차단한다.
  - 사용하지 않는 `OwnershipGuard` 죽은 코드를 삭제하고, 객체별 권한 검증은 service-level ownership/participant validation 표준으로 문서를 정리했다.
- 문서:
  - `docs/security-review-log.md`: “정지 사용자 기존 accessToken 재사용 취약점” 별도 섹션 추가.
  - `docs/report-notes.md`: 보고서용 “취약점 발견 → 원인 → 영향 → 패치 → 검증 결과” 흐름 추가.
  - `docs/test-checklist.md`: JwtAuthGuard/RolesGuard/WebSocket/ReportsService 회귀 검증 항목 추가.
  - `docs/architecture.md`: pipeline의 `OwnershipGuard` 표현을 service-level ownership/participant validation 기준으로 정정.
  - `README.md`: 보안 패치 요약과 검증 명령을 짧게 추가.
- 테스트:
  - RED 확인: 신규 회귀 테스트 추가 후 `JwtAuthGuard`, `RolesGuard`, `ChatsGateway`, `ReportsService` 관련 테스트 실패 확인.
  - GREEN 확인: targeted test 통과. 4 files / 20 tests.
  - 전체 테스트: `npm run test` 통과. 30 files / 216 tests.
- 검증 결과:
  - `npm install`: 통과, 취약 패키지 0건.
  - `npx prisma validate`: 통과. Prisma 7 예정 deprecation warning(`package.json#prisma`)만 표시.
  - `npm run lint`: 통과.
  - `npm run test`: 통과. 30 files / 216 tests.
  - `npm run build`: 통과.
  - `timeout 8s npm run start`: 최초 실행은 DB 미기동으로 Prisma P1001 실패. `docker compose up -d`로 Postgres/Redis 시작 후 재실행하여 Nest application successfully started 확인, timeout 종료.
  - `rg '\$queryRawUnsafe' backend/src`: production 코드 사용 없음. spec mock과 `not.toHaveBeenCalled()` 검증만 확인.
  - `rg 'passwordHash|refreshToken|TOSS_SECRET|SECRET_KEY' backend/src/modules backend/src/common`: auth password/refresh 처리와 민감정보 미노출 테스트만 확인, Toss secret/key 하드코딩 없음.
- 미실행:
  - frontend 파일 변경이 없어 frontend build는 실행하지 않았다.
- 커밋:
  - 사용자 요청에 따라 커밋하지 않았다.

## 2026-06-28 / branch: feat/reports-admin-moderation

### Reports / Blocks / Admin Moderation 구현

- 구현 기능:
  - `POST /api/reports`, `GET /api/reports/me`: USER/PRODUCT 신고, 중복 신고 409, 자기 자신/자기 상품 신고 400, 내 신고 목록 조회.
  - `POST /api/blocks`, `DELETE /api/blocks/:blockedUserId`, `GET /api/blocks`: 사용자 차단/해제/목록, 중복 차단 idempotent 반환.
  - `GET/PATCH /api/admin/reports`: 관리자 신고 목록/상세/상태 처리, 처리 시 AdminLog 기록.
  - `GET/PATCH /api/admin/products`: 관리자 상품 목록, hide/restore, 조치 시 AdminLog 기록.
  - `GET/PATCH /api/admin/users`: 관리자 사용자 목록, suspend/restore, 자기 자신 정지 및 마지막 ACTIVE 관리자 정지 방지.
  - `GET /api/admin/logs`: append-only 관리자 로그 pagination 조회.
- 보안 연결:
  - 모든 `/api/admin/*`에 `JwtAuthGuard + RolesGuard + @Roles(Role.ADMIN)` 적용.
  - `createChat`, `sendMessage`, `createTransaction`에서 양방향 Block 관계 확인 후 403.
  - 정지 사용자의 Products/Chats/Transactions/Payments 신규 변경 행위 403 제한. 읽기 API는 본인 데이터 확인 목적상 허용.
  - 관리자 상품 restore 시 `RESERVED/PAYMENT_PENDING/PAID/SHIPPING/COMPLETED` 거래가 있으면 재판매 방지를 위해 409.
- DB 변경:
  - `Report.description`, `adminId`, `adminNote`, `reviewedAt`, `@@unique([reporterId, type, targetId])` 추가.
  - `AdminLog.targetType`, `reason` 및 조회용 index 추가.
  - migration `20260628090000_add_reports_admin_moderation` 추가.
- 테스트:
  - RED 확인: 신규 모듈/DTO 미존재 및 차단/정지 제한 부재로 `npm run test` 실패 확인.
  - GREEN 확인: `npm run test` 통과. 29 files / 209 tests.
- 검증 결과:
  - `npm install`: 통과, 취약 패키지 0건.
  - `npx prisma validate`: 통과.
  - `npm run lint`: 통과.
  - `npm run test`: 통과. 29 files / 209 tests.
  - `npm run build`: 통과.
  - `timeout 8s npm run start`: Nest application successfully started 및 Reports/Blocks/Admin routes 매핑 확인 후 timeout 종료.
  - `docker compose config`: 통과.
  - `docker compose up -d`: 통과. Postgres/Redis running.
  - `npx prisma migrate status`: 최초 pending 확인, `npx prisma migrate deploy` 적용 후 최종 schema up to date.
  - `npm run db:seed`: 통과.
  - `git diff --check`: 통과.
- 미실행:
  - frontend 파일 변경이 없어 `cd frontend && npm run build`는 실행하지 않았다.

## 2026-06-28 / branch: feat/payments-secure-escrow

### Payments / 안전거래 구현

- 구현 기능:
  - `POST /api/payments`: 구매자 전용 안전결제 생성, 서버 기준 amount 저장, idempotency 재요청 처리, transaction `PAYMENT_PENDING` 전이.
  - `POST /api/payments/:id/approve`: Toss success URL의 `paymentKey/orderId/amount`를 DB와 대조한 뒤 Toss confirm API 호출, 승인 성공 시 `Payment.status=PAID`, `Transaction.status=PAID`.
  - `POST /api/payments/webhook`: 공개 endpoint이지만 raw body HMAC 서명 검증 후 처리, amount/status DB 대조, 중복 웹훅 idempotent 처리.
  - `POST /api/payments/:id/confirm`: 구매자 구매 확정, `escrowReleased=true`, 거래 완료, 상품 판매완료 전이.
  - `POST /api/payments/:id/refund`: 당사자 전용 환불, 구매 확정 후 일반 환불 제한, Toss cancel API adapter 연동.
  - `GET /api/payments/:id/receipt`: 거래 당사자 전용 영수증 조회, 민감 사용자 정보 제외.
  - Toss provider adapter와 mock 기반 unit test 분리.
  - frontend payments API wrapper 추가.
- DB 변경:
  - `PaymentStatus`에 `FAILED`, `CANCELED` 추가.
  - `Payment`에 `orderId`, `orderName`, `receiptUrl`, `paidAt`, `refundedAt`, `updatedAt` 추가.
  - migration `20260628050000_add_payments_toss_fields` 추가.
- 문서:
  - README, API spec, architecture, database design, security review log, test checklist, report notes 갱신.

### 테스트 결과

- `cd backend && npm install`: 통과, 취약 패키지 0건.
- `cd backend && npx prisma validate`: 통과.
- `cd backend && npm run lint`: 통과.
- `cd backend && npm run test`: 통과. 22 files / 162 tests.
- `cd backend && npm run build`: 통과.
- `cd backend && timeout 8s npm run start`: Nest application successfully started 및 Payments routes 매핑 확인 후 timeout 종료.
- `docker compose config`: 통과.
- `docker compose up -d`: 통과. Postgres/Redis running.
- `cd backend && npx prisma migrate status`: 최종 통과, database schema up to date.
- `cd backend && npm run db:seed`: 통과.
- `cd frontend && npm run build`: 통과.
- `git diff --check`: 통과.

### 미실행/환경 제약

- Toss sandbox 실제 카드/간편결제 승인·취소는 외부 test key와 webhook endpoint 설정이 필요해 unit test에서는 provider mock으로 검증했다.
- `npm run start`는 장기 실행 명령이라 프로세스를 남기지 않기 위해 timeout으로 종료했다.

## 2026-06-28 / branch: feat/transactions-secure-flow

### 커밋 기준 작업 요약

- `ed10555 chore(infra)`: NestJS/Prisma/PostgreSQL/Redis/React 기반 보안 중심 프로젝트 골격, 환경변수 검증, CORS/Helmet/ValidationPipe 기본값 구성.
- `0296390 feat(auth)`: 회원가입/로그인, bcrypt password hash, JWT access/refresh, refresh session rotation, 사용자 프로필 API 구현.
- `f29b135 feat(products)`: 상품 CRUD, 작성자 검증, 검색, 찜, 이미지 업로드 검증, 공개 응답 필드 제한 구현.
- `21b20b9 feat(chats)`: 채팅방 생성, 참여자 전용 조회/메시지/읽음 처리, WebSocket 참여자 검증, 메시지 XSS 방어 관점 테스트 구현.

### 현재 작업 트리: Transactions 후속 구현 및 정리

- 구현 기능:
  - 거래 요청, 예약, 취소, 완료, 내 거래 목록, 후기 작성 API 추가.
  - 거래 당사자 검증, 판매자 전용 전이 검증, 서버 상태 머신, 서버 기준 amount 저장.
  - 완료 거래 후기 중복 방지를 위한 `Review @@unique([transactionId, authorId])` schema 변경.
  - 정상 기능 확인용 dev seed 추가.
  - frontend transactions API 함수 추가.
  - stale `dist/src` 로드 문제 방지를 위해 backend `clean`/`prebuild` script와 seed build exclude 정리.
- 변경 파일:
  - `backend/src/modules/transactions/**`
  - `backend/src/app.module.ts`
  - `backend/prisma/schema.prisma`
  - `backend/prisma/seed.ts`
  - `backend/package.json`
  - `backend/tsconfig.build.json`
  - `frontend/src/api/transactions.ts`
  - `README.md`
  - `docs/report-requirements.md`
  - `docs/dev-log.md`
  - `docs/security-review-log.md`
  - `docs/test-checklist.md`
  - `docs/report-notes.md`

### 테스트 결과

- `cd backend && npm install`: 통과.
- `cd backend && npx prisma validate`: 통과.
- `cd backend && npm run lint`: 통과.
- `cd backend && npm run test`: 통과. 18 files / 138 tests.
- `cd backend && rm -rf dist && npm run build && npm run start`: 통과. Nest application successfully started 확인 후 검증용 timeout으로 종료.
- `docker compose config`: 통과.
- `docker compose up -d`: 통과. `whs-market-postgres`, `whs-market-redis` 모두 healthy.
- `cd backend && npx prisma migrate dev --name add-review-author-unique`: 통과. DB schema up to date, `_prisma_migrations`에 `20260628020031_add_review_author_unique` 완료 기록 확인.
- `cd backend && npm run db:seed`: 통과. `seller@example.com`, `buyer@example.com`, `admin@example.com` dev seed 완료.
- `cd frontend && npm run build`: 통과.
- `git diff --check`: 통과.

### 미실행/실패 검증 사유

- 없음. Docker, PostgreSQL, Redis가 동작하는 WSL 환경에서 compose, migration, seed, backend start까지 확인했다.
- `npm run start`는 장기 실행 서버 명령이므로 검증 중 프로세스를 남기지 않기 위해 timeout으로 종료했다.

### DB 검증 명령

```bash
docker compose config
docker compose up -d
cd backend
npx prisma migrate dev --name add-review-author-unique
npm run db:seed
npm run start
```
