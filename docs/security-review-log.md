# 보안 리뷰 로그

이 문서는 의도적 취약점 삽입이 아니라 정상 기능 개발 중 보안 약점을 예방하고 확인한 내용을 정리한다.

## Auth

- Password hash: 회원가입 시 bcrypt hash를 저장하고 평문 비밀번호를 저장하거나 응답하지 않는다.
- Refresh rotation: refresh token은 httpOnly cookie 기반으로 운용하고 Redis session/jti 검증 및 회전 흐름을 둔다.
- DTO whitelist: 회원가입/로그인/프로필 DTO에서 role, status, trustScore, completedTx 같은 권한/상태 필드 주입을 거부한다.
- 응답 제한: 공개 프로필과 인증 응답에서 passwordHash 등 내부 필드를 제외한다.

## 정지 사용자 기존 accessToken 재사용 취약점

### 발견된 취약점

- 기존 `JwtAuthGuard`와 `ChatsGateway`는 JWT 서명은 검증했지만 DB의 `User.status`를 재확인하지 않았다.
- `RolesGuard`는 role만 확인하고 status를 확인하지 않았다.
- 이로 인해 `SUSPENDED`/`BANNED` 처리된 사용자 또는 관리자가 기존 accessToken이 만료되기 전까지 일부 API를 계속 호출할 수 있는 위험이 있었다.

### 원인

- JWT payload의 `sub/email/role`을 신뢰하고 `request.user` 또는 `socket.data.user`에 그대로 사용했다.
- 권한 판단 시 DB의 최신 사용자 상태를 기준으로 하지 않았다.
- 관리자 API도 `role=ADMIN` 여부만 확인하고 `ACTIVE` 상태를 요구하지 않았다.

### 보안 영향

- 정지된 일반 사용자가 기존 accessToken으로 상품/채팅/거래/신고 등 일부 기능에 접근할 수 있는 위험이 있었다.
- 정지된 관리자가 기존 ADMIN 토큰으로 관리자 API를 호출할 수 있는 위험이 있었다.
- WebSocket 연결에서 정지 사용자가 `join`/`read` 이벤트를 계속 사용할 수 있는 위험이 있었다.

### 패치 내용

- `JwtAuthGuard`에서 JWT payload는 `sub` 식별 힌트로만 사용하고, 실제 `id/email/role/status`는 DB에서 재조회한다.
- `User.status !== ACTIVE`이면 HTTP API를 401로 거부한다.
- `RolesGuard`에서 role뿐 아니라 `status=ACTIVE`도 요구한다.
- `ChatsGateway`에서 WebSocket 연결 시 DB status를 재확인하고 inactive user는 disconnect한다.
- `ReportsService`에서 정지 사용자의 신고 생성도 403으로 차단한다.
- 사용하지 않는 `OwnershipGuard` 죽은 코드를 삭제하고, service layer ownership/participant 검증 구조와 문서를 일치시켰다.
- Redis 기반 status cache는 요청마다 DB 재조회 비용을 줄이기 위한 추후 최적화 후보로 남기고, 이번 패치는 단순 DB 재조회 방식으로 적용했다.

### 검증 결과

- `JwtAuthGuard`: `SUSPENDED` 사용자의 유효한 accessToken이 401 처리되는 테스트를 추가했다.
- `JwtAuthGuard`: ACTIVE 사용자는 통과하고 `request.user.role/status`가 JWT payload가 아니라 DB 값으로 채워지는 테스트를 추가했다.
- `RolesGuard`: `SUSPENDED ADMIN`의 관리자 API 접근이 403 처리되는 테스트를 추가했다.
- `RolesGuard`: `ACTIVE ADMIN`은 통과하고 `ACTIVE USER`는 관리자 API에서 403 처리되는 테스트를 추가했다.
- `ChatsGateway`: `SUSPENDED` 사용자의 WebSocket 연결이 거부/disconnect되는 테스트를 추가했다.
- `ReportsService`: `SUSPENDED` 사용자의 신고 생성이 403 처리되는 테스트를 추가했다.
- 전체 검증: `npm install`, `npx prisma validate`, `npm run lint`, `npm run test`(30 files / 216 tests), `npm run build`, `timeout 8s npm run start`를 실행했다.
- `timeout 8s npm run start`는 DB 미기동 상태에서 Prisma P1001을 먼저 확인했고, `docker compose up -d` 후 재실행해 Nest application successfully started까지 확인했다.
- 추가 검색: `$queryRawUnsafe`는 production 코드가 아니라 spec mock/미호출 검증에서만 확인했고, Toss secret/key 하드코딩은 발견되지 않았다.

## Products

- Seller 검증: 상품 수정, 삭제, 상태 변경, 이미지 업로드는 `product.sellerId === currentUser.id`를 서비스에서 검증한다.
- SQLi 방어: 검색은 Prisma `findMany` 조건과 파라미터 바인딩 경로만 사용하고 `$queryRawUnsafe`를 사용하지 않는다.
- 파일 업로드 검증: jpg/jpeg/png/webp만 허용하고 확장자, MIME, 매직바이트, 크기, 이중 확장자를 검증한다.
- Mass assignment 방어: 상품 등록/수정에서 `sellerId`, `status`, `isHidden` 주입을 DTO 단계에서 거부한다.
- 응답 제한: seller 공개 정보만 선택하고 `passwordHash`, `email`, `phone`을 조회하지 않는다.

## Chats

- Participant 검증: 채팅방 상세, 메시지 목록, 메시지 전송, 읽음 처리는 buyer 또는 seller 참여자만 가능하다.
- 메시지 XSS 방어: 메시지는 일반 문자열 데이터로 저장/반환하고 HTML 렌더링 구조를 응답하지 않는다.
- Mass assignment 방어: `buyerId`, `sellerId`, `senderId`, `chatId`, `isRead` 주입을 DTO 단계에서 거부한다.
- WebSocket: handshake에서 DB status를 재확인하고, join/message/read 이벤트에서도 서비스 레벨 참여자 검증을 수행한다.

## Transactions

- 당사자 검증: 거래 조회/취소/후기는 buyer 또는 seller만 가능하고, 예약/완료는 seller만 가능하다.
- 상태머신: `REQUESTED -> RESERVED`, `REQUESTED|RESERVED|PAYMENT_PENDING -> CANCELLED`, `RESERVED|SHIPPING -> COMPLETED`만 허용한다.
- Amount 서버 계산: 거래 요청 body는 `productId`만 허용하고 `amount`는 DB의 `product.price`에서 복사한다.
- 상태/권한 필드 불신: `buyerId`, `sellerId`, `amount`, `status`, `authorId`, `targetId`, `transactionId` 주입을 DTO 단계에서 거부한다.
- 상태 동기화: 예약/취소/완료에서 Prisma `$transaction`과 조건부 update로 `Transaction.status`와 `Product.status`를 함께 갱신한다.
- 중복 후기 방지: 서비스에서 기존 review를 확인하고, schema에 `Review @@unique([transactionId, authorId])`를 추가해 DB 레벨 방어를 준비했다.
- 응답 제한: buyer/seller/author/target은 공개 정보만 선택하고 민감정보를 조회하지 않는다.

## Payments

- Toss sandbox/test 흐름: QR 이미지 업로드나 단순 완료 버튼 없이 `POST /payments` 결제 생성, `POST /payments/:id/approve` Toss confirm, `POST /payments/webhook` 상태 동기화를 사용한다.
- Amount 서버 계산: 결제 생성 DTO는 `transactionId`, `idempotencyKey`만 허용하고 amount/user/status 필드 주입을 거부한다. 저장 금액은 `Transaction.amount`와 `Product.price`를 서버에서 대조한다.
- Buyer 검증: 결제 생성, Toss 승인, 구매 확정은 `transaction.buyerId === currentUser.id`일 때만 가능하다.
- Idempotency: 동일 `idempotencyKey` 재요청은 기존 Payment를 반환하고, 같은 transaction에 다른 키로 중복 결제하면 409로 거부한다.
- Toss 승인 검증: success URL의 `paymentKey`, `orderId`, `amount`를 DB 값과 대조한 뒤에만 Toss confirm API를 호출한다.
- Webhook 검증: 공개 endpoint지만 raw body HMAC 서명 검증을 통과해야 하며, amount/status payload를 그대로 신뢰하지 않고 DB Payment와 대조한다.
- Escrow 정책: `PAID` 이후에도 `escrowReleased=false`로 유지하고, 구매자 구매 확정 시에만 `escrowReleased=true`와 `Transaction.status=COMPLETED`로 전이한다.
- Refund 정책: 당사자만 환불 가능하고, `escrowReleased=true` 이후 일반 환불은 제한한다.
- 응답 제한: receipt는 거래 당사자만 조회 가능하고 buyer/seller의 passwordHash, email, phone을 선택하지 않는다.
- SQLi 방어: Payments 모듈은 Prisma ORM만 사용하며 `$queryRawUnsafe`를 사용하지 않는다.

## Reports / Blocks / Admin Moderation

- Reports: `reporterId`, `status`, `adminId`, `role`은 body에서 받지 않고 access token subject와 서버 상태로만 결정한다. USER/PRODUCT 대상만 허용하며 자기 자신 신고와 자기 상품 신고는 400, 중복 신고는 DB unique 제약과 서비스 검사로 409 처리한다. 정지된 사용자의 신고 생성은 403으로 차단한다.
- Blocks: `blockerId`는 current user id로만 설정한다. 자기 자신 차단은 400, 중복 차단은 기존 Block 반환으로 idempotent 처리한다.
- Block 적용: `createChat`, `sendMessage`, `createTransaction`은 buyer/seller 양방향 Block 관계를 조회하고 존재하면 403으로 거부한다.
- Admin 권한: 모든 `/api/admin/*` 컨트롤러는 `JwtAuthGuard + RolesGuard + @Roles(Role.ADMIN)`로 보호한다. 일반 사용자는 403이고, `role=ADMIN`이어도 `User.status !== ACTIVE`이면 403이다.
- AdminLog: 신고 처리, 상품 hide/restore, 사용자 suspend/restore는 모두 `AdminLog`에 append-only 기록한다. 로그 수정/삭제 API는 만들지 않는다.
- 관리자 상품 restore 안전 검증: 기본 복구 정책은 `HIDDEN -> ON_SALE`이지만, 해당 상품에 `RESERVED`, `PAYMENT_PENDING`, `PAID`, `SHIPPING`, `COMPLETED` 거래가 있으면 재판매 사고 방지를 위해 409로 거부한다.
- 사용자 정지: `User.status !== ACTIVE` 사용자는 로그인/refresh뿐 아니라 기존 accessToken을 사용한 HTTP API와 WebSocket 연결도 DB status 재확인으로 차단된다.
- 마지막 관리자 보호: 관리자 자기 자신 정지는 400, 마지막 ACTIVE 관리자 정지는 403으로 거부한다.
- 응답 제한: 관리자 목록/로그 응답은 `passwordHash`, refresh token, Toss secret/key, token, phone/email을 선택하지 않는다.
- SQLi 방어: 신규 Reports/Blocks/Admin 모듈과 기존 연결 제한은 Prisma ORM만 사용하며 `$queryRawUnsafe`를 사용하지 않는다.
