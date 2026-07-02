# SecondHand Market

Security-first secondhand marketplace skeleton.

## Development

```bash
docker compose up -d
```

Backend:

```bash
cd backend
cp .env.example .env
npm install
npx prisma validate
npm run start:dev
```

Security patch checks:

- `JwtAuthGuard` and WebSocket auth re-read `User.status` from DB; inactive users cannot reuse an unexpired accessToken.
- Admin routes require both `role=ADMIN` and `User.status=ACTIVE`.
- Object ownership/participant checks are enforced in services.

```bash
cd backend
npm install
npx prisma validate
npm run lint
npm run test
npm run build
timeout 8s npm run start
```

## Auth API

Base URL: `/api`

- `POST /api/auth/register`: email, password, nickname으로 회원가입
- `POST /api/auth/login`: access token 발급, refresh token은 httpOnly cookie로 설정
- `POST /api/auth/refresh`: refresh cookie 검증 후 access/refresh token 회전
- `POST /api/auth/logout`: refresh 세션 무효화 및 cookie 삭제
- `GET /api/users/me`: 내 프로필 조회, Bearer access token 필요
- `PATCH /api/users/me`: nickname, bio, avatarUrl만 수정
- `GET /api/users/:id`: 공개 프로필 조회, `id`는 UUID만 허용
- `GET /api/users/:id/private`: 본인 또는 ADMIN만 private 프로필 조회

## Products API

Base URL: `/api/products`

- `GET /api/products`: 공개 상품 목록. `page`, `limit`, `sort=latest|priceAsc|priceDesc`, `category`, `min`, `max` 지원
- `GET /api/products/search`: 공개 검색. `q` 필수, Prisma `contains` 조건으로만 검색
- `GET /api/products/:id`: 공개 상세 조회, 숨김 상품 제외
- `POST /api/products`: 인증 필요. `title`, `price`, `description`, `category`, `region`만 허용
- `PATCH /api/products/:id`: 작성자만 수정 가능
- `DELETE /api/products/:id`: 작성자만 가능, `isHidden=true`와 `status=HIDDEN`으로 soft delete
- `PATCH /api/products/:id/status`: 작성자만 가능, `ON_SALE`, `RESERVED`, `SOLD`만 허용
- `POST /api/products/:id/images`: 작성자만 가능, jpg/jpeg/png/webp 이미지 업로드
- `POST /api/products/:id/favorite`: 인증 사용자 기준 찜 토글

Products 보안 정책:

- 클라이언트가 보낸 `sellerId`, `userId`, `status`, `isHidden`은 DTO에서 거부하거나 서버 값으로만 결정한다.
- 상품 등록의 `sellerId`와 찜의 `userId`는 access token subject에서만 가져온다.
- 상품 수정, 삭제, 상태 변경, 이미지 업로드는 서비스 레벨에서 `product.sellerId === currentUser.id`를 검증한다.
- 목록, 검색, 상세는 `isHidden=false` 상품만 반환한다.
- 검색은 Prisma ORM 조건만 사용하며 `$queryRawUnsafe`를 사용하지 않는다.
- 응답의 판매자 정보는 `id`, `nickname`, `avatarUrl`, `trustScore`, `completedTx`로 제한하고 `passwordHash`, `email`, `phone`은 조회하지 않는다.
- `price`는 정수 `0..100000000` 범위로 검증한다.
- 이미지 업로드는 5MB 이하, 요청당 최대 10개, 확장자+MIME+매직바이트를 검증한다. SVG/HTML/PHP/JSP 및 `shell.php.jpg` 같은 이중 확장자는 거부한다.
- 업로드 파일명은 UUID로 재생성하며 원본 파일명은 저장 경로에 사용하지 않는다. 개발/테스트의 `UPLOAD_DIR`은 `./uploads`를 사용할 수 있고, 운영은 웹 루트 밖의 실행 불가 경로를 명시한다.
- 정지된 사용자는 기존 accessToken이 남아 있어도 공통 인증 단계에서 HTTP API 접근이 401로 차단된다.

## Chats API

Base URL: `/api/chats`

- `POST /api/chats`: 인증 필요. `productId`만 허용하며 상품 판매자와 1:1 채팅방을 생성하거나 기존 방을 반환
- `GET /api/chats`: 인증 필요. 내가 buyer 또는 seller인 채팅방만 페이지네이션 조회
- `GET /api/chats/:id`: 인증 필요. 채팅 참여자만 상세 조회 가능
- `GET /api/chats/:id/messages`: 인증 필요. 참여자만 메시지 내역 조회 가능, `createdAt` 오름차순
- `POST /api/chats/:id/messages`: 인증 필요. 참여자만 `content`, `imageUrl` 메시지 전송 가능
- `POST /api/chats/:id/read`: 인증 필요. 상대방이 보낸 안 읽은 메시지만 읽음 처리

Chats 보안 정책:

- 채팅방 조회, 메시지 조회, 메시지 전송, 읽음 처리는 반드시 buyer 또는 seller 참여자만 가능하다.
- `buyerId`, `sellerId`, `senderId`, `userId`, `chatId`, `isRead` 같은 권한 필드는 클라이언트 본문에서 받지 않고 DTO에서 거부한다.
- `buyerId`, `sellerId`, `senderId`는 access token subject와 DB의 product/chat 관계에서만 결정한다.
- 채팅 상세와 메시지 응답의 사용자 정보는 `id`, `nickname`, `avatarUrl`, `trustScore`, `completedTx`로 제한하며 `passwordHash`, `email`, `phone`은 조회하지 않는다.
- 메시지 `content`는 HTML로 렌더링하지 않는 일반 문자열 데이터로 저장하고 반환한다. React에서는 기본 텍스트 바인딩을 사용한다.
- WebSocket `/ws`는 handshake token 인증 후 DB status를 재확인하고, `join`, `message`, `read` 이벤트마다 서비스 레벨 참여자 검증을 수행한다.
- 양방향 Block 관계가 있으면 `createChat`과 `sendMessage`를 403으로 거부한다.
- 정지된 사용자는 기존 WebSocket 토큰이 남아 있어도 연결 단계에서 차단된다.

## Transactions API

Base URL: `/api/transactions`

- `POST /api/transactions`: 인증 필요. `productId`만 허용하며 `buyerId`, `sellerId`, `amount`, `status`는 서버가 결정
- `PATCH /api/transactions/:id/reserve`: 판매자만 가능. `REQUESTED` 거래를 `RESERVED`로 전환하고 상품 상태를 `RESERVED`로 동기화
- `PATCH /api/transactions/:id/cancel`: 구매자 또는 판매자만 가능. `REQUESTED`, `RESERVED`, `PAYMENT_PENDING`만 `CANCELLED`로 전환
- `PATCH /api/transactions/:id/complete`: 판매자만 가능. persisted `PAID` payment가 있는 `PAID`, `SHIPPING` 거래만 `COMPLETED`로 전환하고 상품 상태를 `SOLD`로 동기화
- `GET /api/transactions`: 인증 필요. `role=buyer|seller|all`, `status`, `page`, `limit` 지원. 현재 사용자가 buyer 또는 seller인 거래만 반환
- `POST /api/transactions/:id/reviews`: 완료 거래 당사자만 가능. `rating`, `comment`만 허용하며 `authorId`, `targetId`, `transactionId`는 서버가 결정

Transactions 보안 정책:

- 거래 요청은 `productId`만 받는다. `buyerId`, `sellerId`, `amount`, `status`, `productPrice` 같은 권한/금액/상태 필드는 DTO whitelist에서 거부한다.
- 거래 요청의 `buyerId`는 access token subject, `sellerId`와 `amount`는 DB의 상품 판매자와 가격에서만 결정한다.
- 거래 상태 전이는 서버 상태 머신이 현재 상태와 행위자 권한을 검증한 뒤 수행한다. 클라이언트가 보낸 목표 상태는 사용하지 않는다.
- 예약, 취소, 완료는 Prisma `$transaction` 안에서 `Transaction.status`와 `Product.status`를 함께 갱신한다. 완료 전이는 persisted `PAID` payment를 확인한 뒤에만 수행한다.
- 중복 진행 거래는 같은 구매자와 상품 기준 `REQUESTED`, `RESERVED`, `PAYMENT_PENDING`, `PAID`, `SHIPPING` 상태가 있으면 거부한다.
- 내 거래 내역은 현재 사용자가 buyer 또는 seller인 거래만 조회한다. 타인의 거래 ID를 추측해도 서비스 레벨에서 차단한다.
- 후기는 `COMPLETED` 거래의 buyer 또는 seller만 작성할 수 있고, 상대방 `targetId`는 서버에서 계산한다.
- 응답의 사용자 정보는 `id`, `nickname`, `avatarUrl`, `trustScore`, `completedTx`로 제한하며 `passwordHash`, `email`, `phone`은 조회하지 않는다.
- Prisma ORM만 사용하며 `$queryRawUnsafe`는 거래 모듈에서 사용하지 않는다.
- 양방향 Block 관계가 있으면 `POST /api/transactions`를 403으로 거부한다.
- 정지된 사용자는 기존 accessToken이 남아 있어도 공통 인증 단계에서 거래 API 접근이 401로 차단된다.

## Payments API

Base URL: `/api/payments`

- `POST /api/payments`: 인증 필요. `transactionId`, `idempotencyKey`만 허용하며 amount는 서버가 `Transaction.amount`와 `Product.price`를 대조해 결정
- `POST /api/payments/:id/approve`: 구매자만 가능. Toss success URL의 `paymentKey`, `orderId`, `amount`를 DB와 대조한 뒤 Toss confirm API 호출
- `POST /api/payments/webhook`: 공개 endpoint. Toss webhook 서명 검증 후 DB Payment와 amount/status를 대조해 idempotent하게 상태 반영
- `POST /api/payments/:id/confirm`: 구매자만 가능. `PAID` 결제의 구매 확정 처리, `escrowReleased=true`, 거래 완료, 상품 판매완료 전이
- `POST /api/payments/:id/refund`: 거래 당사자만 가능. 구매 확정 전 환불만 허용하며 Toss cancel API 연동
- `GET /api/payments/:id/receipt`: 거래 당사자만 가능. 영수증/거래/상품 요약과 공개 사용자 정보만 반환

Payments 보안 정책:

- 개발/시연 결제는 Toss Payments sandbox/test 기반으로 검증한다. fake QR 이미지 업로드나 단순 “결제 완료” 버튼은 사용하지 않는다.
- `amount`, `buyerId`, `sellerId`, `status`, `escrowReleased` 같은 권한/금액/상태 필드는 클라이언트 본문에서 받지 않는다.
- 동일 `idempotencyKey` 재요청은 기존 Payment를 반환하고, 같은 거래에 다른 키로 중복 결제하면 409로 거부한다.
- Toss secret key와 webhook secret은 backend `.env`에만 둔다. frontend에는 client key만 노출 가능하다.
- `PAID` 이후에도 구매 확정 전까지 `escrowReleased=false`로 정산을 보류한다.
- 정지된 사용자는 기존 accessToken이 남아 있어도 공통 인증 단계에서 결제 API 접근이 401로 차단된다.

## Reports / Blocks API

Base URL: `/api`

- `POST /api/reports`: 인증 필요. `targetType=USER|PRODUCT|CHAT`, `targetId`, `reason`, `description`만 허용
- `GET /api/reports/me`: 인증 필요. 내 신고 목록만 페이지네이션 조회
- `POST /api/blocks`: 인증 필요. `blockedUserId`만 허용하며 중복 차단은 기존 Block 반환
- `DELETE /api/blocks/:blockedUserId`: 인증 필요. current user의 차단 관계만 해제
- `GET /api/blocks`: 인증 필요. 내가 차단한 사용자 목록 조회

Reports/Blocks 보안 정책:

- `reporterId`, `blockerId`, `status`, `adminId`, `role` 같은 권한/상태 필드는 클라이언트에서 받지 않는다.
- 정지된 사용자는 신고 생성이 403으로 제한된다.
- 자기 자신 신고/차단과 자기 상품 신고는 400으로 거부한다.
- `CHAT` 신고의 `targetId`는 `ChatMessage.id`이며, 채팅 참여자만 상대 메시지를 신고할 수 있다.
- 존재하지 않는 대상은 404, 같은 사용자의 같은 대상 중복 신고는 409로 거부한다.
- 신고/차단 목록은 `limit<=100`으로 제한하고 Prisma ORM만 사용한다.

## Admin Moderation API

Base URL: `/api/admin`

- `GET /api/admin/reports`: ADMIN 전용. `page`, `limit`, `status`, `targetType` 필터
- `GET /api/admin/reports/:id`: ADMIN 전용. 신고 상세 조회
- `PATCH /api/admin/reports/:id/status`: ADMIN 전용. `status=REVIEWING|RESOLVED|REJECTED`, `adminNote`만 허용
- `GET /api/admin/products`: ADMIN 전용. 숨김 상품 포함 관리자 상품 목록
- `PATCH /api/admin/products/:id/hide`: ADMIN 전용. `isHidden=true`, `status=HIDDEN`
- `PATCH /api/admin/products/:id/restore`: ADMIN 전용. 안전 검증 후 `isHidden=false`, `status=ON_SALE`
- `GET /api/admin/users`: ADMIN 전용. 관리자 사용자 목록
- `PATCH /api/admin/users/:id/suspend`: ADMIN 전용. `User.status=SUSPENDED`
- `PATCH /api/admin/users/:id/restore`: ADMIN 전용. `User.status=ACTIVE`
- `GET /api/admin/logs`: ADMIN 전용. append-only 관리자 조치 로그 조회

Admin 보안 정책:

- 모든 `/api/admin/*`는 `JwtAuthGuard + RolesGuard + @Roles(ADMIN)`로 보호하며, ADMIN role과 ACTIVE status를 모두 요구한다.
- 관리자 상품 restore는 해당 상품에 `RESERVED`, `PAYMENT_PENDING`, `PAID`, `SHIPPING`, `COMPLETED` 거래가 있으면 재판매 방지를 위해 409로 거부한다.
- 관리자 자기 자신 정지는 400, 마지막 ACTIVE 관리자 정지는 403으로 거부한다.
- 정상 경로의 관리자 상태 변경은 `AdminLog`에 기록한다. 로그 수정/삭제 API는 없다. 상태 변경과 로그 insert의 transaction 원자성은 운영 전 보강 대상이다.
- 관리자 목록/로그 응답은 `passwordHash`, refresh token, Toss secret/key, token, phone/email을 반환하지 않는다.

## Notifications API

Base URL: `/api/notifications`

- `GET /api/notifications`: 인증 필요. 내 알림만 페이지네이션 조회, `unreadOnly=true` 지원
- `POST /api/notifications/:id/read`: 인증 필요. 내 알림만 읽음 처리, 이미 읽은 알림은 현재 상태 반환

Notifications 보안 정책:

- `userId`는 body/query에서 받지 않고 access token subject만 사용한다.
- 알림 조회와 읽음 처리는 항상 `notification.userId === currentUser.id` 조건으로 수행한다.
- 타인 알림 id 또는 없는 알림 id의 읽음 요청은 404로 통일한다.
- 응답은 `id`, `type`, `title`, `message/body`, `isRead`, `createdAt`, `target`만 포함하며 민감정보를 반환하지 않는다.

## Dev Seed

개발 환경에서 프론트엔드 개발과 최종 시연에 필요한 더미 데이터만 제공한다. 실제 서비스 로직을 mock으로 바꾸지 않으며, 취약점 시연용 우회 계정이나 실제 결제 키는 포함하지 않는다.

Transactions 구현에서 `Review` 모델에 `@@unique([transactionId, authorId])`가 추가되었고, Notifications API 보완에서 `Notification.targetType/targetId`와 `Product.sellerId` index migration이 추가되었다.

```bash
cd backend
npx prisma migrate deploy
```

검증 결과 `docker compose up -d`로 PostgreSQL/Redis를 실행한 뒤 `npx prisma migrate deploy`로 `20260628110000_add_notifications_targets_and_product_seller_index`까지 적용했으며, 최종 `npx prisma migrate status`는 `Database schema is up to date` 상태를 보고했다.

```bash
cd backend
npm run db:seed
# 또는
npm run seed:dev
```

검증 결과 `npm run db:seed`가 정상 완료되었다.

Docker/DB 검증 결과:

- `docker compose config`: 통과
- `docker compose up -d`: 통과, `whs-market-postgres`와 `whs-market-redis` healthy
- `npx prisma migrate deploy`: 통과, schema up to date
- `npm run db:seed`: 2회 연속 실행 통과
- `npm run start`: Nest application successfully started 확인. 서버 프로세스를 남기지 않기 위해 검증 시 timeout으로 종료

개발/테스트 Seed 계정:

- `seller@example.com` / `Password123!`
- `buyer@example.com` / `Password123!`
- `admin@example.com` / `Password123!`
- `suspended@example.com` / `Password123!` (`SUSPENDED`)
- `banned@example.com` / `Password123!` (`BANNED`)
- `secondbuyer@example.com` / `Password123!`
- `secondseller@example.com` / `Password123!`

`admin@example.com` / `Password123!`는 개발/테스트 seed 전용 계정이다. 운영 환경에서는 seed 실행이 차단되며 admin 비밀번호를 프론트엔드 소스에 넣지 않는다.

Seed 데이터:

- 상품 11개: `ON_SALE`, `RESERVED`, `SOLD`, `HIDDEN`, 신고/이미지/검색 키워드 시연용 포함
- buyer/seller 및 secondbuyer/seller 채팅방 2개와 메시지 여러 개
- `REQUESTED`, `RESERVED`, `PAYMENT_PENDING`, `PAID`, `COMPLETED`, `CANCELLED`, `REFUNDED` 거래 각 1개
- `PENDING`, `PAID`, `REFUNDED` payment와 `escrowReleased=false/true` 상태
- 완료 거래에 대한 후기 1개
- `USER`, `PRODUCT`, `CHAT` report 및 `PENDING`, `REVIEWING`, `RESOLVED`, `REJECTED` 상태
- buyer가 `blocked@example.com`, `banned@example.com`, `secondbuyer@example.com` 사용자를 차단한 Block 데이터
- read/unread notification과 `CHAT`, `TRANSACTION`, `REPORT` target
- `HIDE_PRODUCT`, `RESTORE_PRODUCT`, `SUSPEND_USER`, `RESTORE_USER`, `UPDATE_REPORT_STATUS` AdminLog

Seed 비밀번호는 bcrypt로 해시하며 passwordHash를 출력하지 않는다. Toss paymentKey/orderId는 `dev_seed_*` 형태의 테스트 값만 사용하고, secret key나 refresh token은 seed에 넣지 않는다. 여러 번 실행해도 기존 개발 데이터를 갱신하는 방식으로 동작한다.

## Backend Environment

Required backend env values:

```bash
DATABASE_URL=postgresql://market_user:market_password@localhost:5432/market
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=change-me
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_SECRET=change-me
JWT_REFRESH_EXPIRES=7d
CORS_ORIGIN=http://localhost:5173
PG_WEBHOOK_SECRET=change-me # legacy fallback
TOSS_CLIENT_KEY=test_ck_change-me
TOSS_SECRET_KEY=test_sk_change-me
TOSS_WEBHOOK_SECRET=change-me
PAYMENT_SUCCESS_URL=http://localhost:5173/payments/success
PAYMENT_FAIL_URL=http://localhost:5173/payments/fail
PAYMENT_CANCEL_URL=http://localhost:5173/payments/cancel
FRONTEND_ORIGIN=http://localhost:5173
LOGIN_MAX_ATTEMPTS=5
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX=100
```

Use real secrets only in local `.env` or deployment secret storage. Do not commit real secret values.

## Token Storage Policy

Refresh tokens are set as `refreshToken` cookies with `httpOnly: true`, `sameSite: strict`, `secure: true` in production, and `path: /api/auth`. Refresh token JTIs are stored in Redis and rotated on every refresh.

Do not store access tokens in `localStorage`. Keep them in memory on the client and refresh through the httpOnly cookie.

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Pre-Commit Verification

```bash
docker compose config
cd backend
npm install
npx prisma validate
npm run lint
npm run test
npm run build
cd frontend && npm run build
```

No real `.env` files or secrets should be committed. API endpoints must follow `docs/api-spec.md`; this bootstrap only creates the secure skeleton.
