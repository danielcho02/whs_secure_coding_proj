# 보안 리뷰 로그

이 문서는 의도적 취약점 삽입이 아니라 정상 기능 개발 중 보안 약점을 예방하고 확인한 내용을 정리한다.

## Auth

- Password hash: 회원가입 시 bcrypt hash를 저장하고 평문 비밀번호를 저장하거나 응답하지 않는다.
- Refresh rotation: refresh token은 httpOnly cookie 기반으로 운용하고 Redis session/jti 검증 및 회전 흐름을 둔다.
- DTO whitelist: 회원가입/로그인/프로필 DTO에서 role, status, trustScore, completedTx 같은 권한/상태 필드 주입을 거부한다.
- 응답 제한: 공개 프로필과 인증 응답에서 passwordHash 등 내부 필드를 제외한다.

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
- WebSocket: join/message/read 이벤트에서도 서비스 레벨 참여자 검증을 수행한다.

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
