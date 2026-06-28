# API 명세 (REST API Specification)

Base URL: `/api`
인증: `Authorization: Bearer <accessToken>` (리프레시는 httpOnly 쿠키)
공통 응답: `{ "success": boolean, "data"?: ..., "error"?: { "code", "message" } }`
에러 메시지는 내부 구현을 노출하지 않는다(NFR-07).

각 엔드포인트의 **🔒 표시는 서버 측에서 강제해야 하는 권한 검사**다.

---

## 1. Auth `/api/auth`

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/register` | 회원가입 | 공개 |
| POST | `/login` | 로그인 (실패 5회 잠금) | 공개, RateLimit |
| POST | `/refresh` | 토큰 회전 | 쿠키 |
| POST | `/logout` | 토큰 무효화 | 인증 |

```http
POST /api/auth/register
{ "email": "a@b.com", "password": "Str0ng!pw", "nickname": "dan" }
→ 201 { "success": true, "data": { "id": "..." } }
```
```http
POST /api/auth/login
{ "email": "a@b.com", "password": "..." }
→ 200 { "success": true, "data": { "accessToken": "..." } }
   Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict
```
> 🔒 비밀번호는 bcrypt 비교(SR-01). 실패 시 Redis 카운터(SR-02). 응답에 passwordHash 등 포함 금지(SR-39).

---

## 2. Users `/api/users`

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/me` | 내 프로필 | 인증 |
| GET | `/:id` | 공개 프로필(신뢰도·평점) | 공개 |
| PATCH | `/me` | 프로필 수정 | 🔒 본인만 |
| GET | `/:id/private` | 연락처 등 민감정보 | 🔒 본인/관리자만 (SR-30) |

> 🔒 `GET /:id`는 email·phone 미포함, 공개 필드만(SR-29, SR-39).

---

## 3. Products `/api/products`

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/` | 목록(정렬·필터·페이지) | 공개 |
| GET | `/search` | 검색(키워드·카테고리·가격범위) | 공개 |
| GET | `/:id` | 상세 | 공개 |
| POST | `/` | 등록 | 인증 |
| PATCH | `/:id` | 수정 | 🔒 작성자만 (SR-06) |
| DELETE | `/:id` | 삭제 | 🔒 작성자만 (SR-06) |
| PATCH | `/:id/status` | 상태 변경 | 🔒 작성자만 (SR-08) |
| POST | `/:id/images` | 이미지 업로드 | 🔒 작성자만 (SR-16~21) |
| POST | `/:id/favorite` | 찜 토글 | 인증 |

```http
POST /api/products
{ "title":"아이폰","price":300000,"category":"디지털","description":"..." }
```
> 🔒 `price`는 정수·범위 검증(SR-14). `description`은 저장 시 무해, 출력 시 escape(SR-13).
> 🔒 `PATCH /:id` 시 `sellerId`, `status` 같은 필드는 DTO 화이트리스트로 무시(Mass Assignment, SR-15).
> 🔒 이미지: 확장자+MIME+매직바이트 검증, UUID 파일명, 실행 불가 경로 저장(SR-16~21).

```http
GET /api/products/search?q=아이폰&category=디지털&min=10000&max=500000
```
> 🔒 검색은 Prisma 파라미터 바인딩만 사용(SR-12). 문자열 보간 금지.

---

## 4. Chats `/api/chats`  (+ WebSocket `/ws`)

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/` | 채팅방 생성(productId) | 인증 |
| GET | `/` | 내 채팅방 목록 | 🔒 참여자 본인 |
| GET | `/:id` | 채팅방 상세 | 🔒 참여자만 (SR-07) ★BOLA |
| GET | `/:id/messages` | 메시지 내역 | 🔒 참여자만 (SR-07) ★BOLA |
| POST | `/:id/messages` | 메시지 전송 | 🔒 참여자만, escape |
| POST | `/:id/read` | 읽음 처리 | 🔒 참여자만 |

WebSocket:
```
connect  { auth: { token } }            → handshake에서 JWT 검증(SR-34)
emit "join" { chatId }                  → 참여자 검증(SR-07)
emit "message" { chatId, content }      → 발신자=참여자 확인 + escape(SR-13)
```
> ★ `GET /api/chats/4`를 남의 방 번호로 바꿔 접근하는 것이 대표 IDOR. 서버에서 `chat.buyerId == me || chat.sellerId == me` 검증 필수.

---

## 5. Transactions `/api/transactions`

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/` | 거래 요청 | 인증(구매자) |
| PATCH | `/:id/reserve` | 예약 처리 | 🔒 판매자만 (SR-08) |
| PATCH | `/:id/cancel` | 취소 | 🔒 당사자만 (SR-08,26) |
| PATCH | `/:id/complete` | 완료 처리 | 🔒 판매자만 (SR-08) |
| GET | `/` | 내 거래 내역 | 🔒 당사자만 (SR-35) |
| POST | `/:id/reviews` | 후기 작성 | 🔒 완료 거래 당사자만 |

> 🔒 상태 전이는 현재 상태 + 행위자 권한을 서버에서 검증(상태 머신). 클라가 보낸 목표 상태 그대로 적용 금지(SR-15).
> 🔒 이미 SOLD 상품 중복 거래 차단(조건부 update + 트랜잭션).

---

## 6. Payments `/api/payments`

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/` | 결제 요청 | 🔒 구매자만, Idempotency, RateLimit |
| POST | `/webhook` | PG 결제 알림 | 서명 검증(SR-23) |
| POST | `/:id/approve` | Toss 결제 승인 콜백 처리 | 🔒 구매자만, 금액 검증 |
| POST | `/:id/confirm` | 구매 확정 | 🔒 구매자만 (SR-26) |
| POST | `/:id/refund` | 환불 요청 | 🔒 당사자+상태 검증 (SR-25) |
| GET | `/:id/receipt` | 영수증 | 🔒 당사자만 (SR-30) |

```http
POST /api/payments
{ "transactionId":"...", "idempotencyKey":"uuid-v4" }
```
→ 201 { "success": true, "data": {
  "id": "...",
  "amount": 300000,
  "status": "PENDING",
  "orderId": "order_...",
  "orderName": "아이폰 15",
  "checkout": {
    "clientKey": "test_ck_...",
    "customerKey": "<buyerId>",
    "successUrl": "http://localhost:5173/payments/success",
    "failUrl": "http://localhost:5173/payments/fail",
    "cancelUrl": "http://localhost:5173/payments/cancel"
  }
} }
```
> 🔒 **금액은 요청 본문에서 받지 않는다.** 서버가 `transaction.amount`와 `transaction.product.price`를 대조해 서버 DB 기준 금액만 저장한다(SR-22).
> 🔒 `idempotencyKey`, `orderId`, `Payment.transactionId` UNIQUE로 중복 결제를 차단한다(SR-24).
> 🔒 같은 transaction에 다른 `idempotencyKey`로 재요청하면 409.

```http
POST /api/payments/:id/approve
{ "paymentKey":"tgen_...", "orderId":"order_...", "amount":300000 }
```
> Toss success URL에서 받은 값을 backend로 전달한다. 서버는 `orderId`, `paymentKey`, `amount`를 DB Payment와 대조한 뒤 Toss confirm API를 호출한다. amount mismatch는 Toss 호출 전 400.
> 승인 성공 시 `Payment.status=PAID`, `Payment.pgTxId=<paymentKey>`, `paidAt`, `receiptUrl` 저장, `Transaction.status=PAID`.

```http
POST /api/payments/webhook
Headers:
  x-toss-signature: v1=<hmac-sha256>
  x-toss-timestamp: <timestamp>
{ "paymentKey":"tgen_...", "orderId":"order_...", "status":"DONE", "amount":300000 }
```
> 🔒 raw body 기반 HMAC 검증 후에만 반영. 서명 불일치 → 401(SR-23).
> 🔒 웹훅 body의 amount/status는 그대로 신뢰하지 않고 DB Payment/Transaction과 대조한다.
> 🔒 중복 웹훅은 상태가 이미 반영된 경우 idempotent하게 무시한다.
> 🔒 `DONE|PAID → PAID`, `CANCELED|CANCELLED|ABORTED|EXPIRED → CANCELED`, `REFUNDED|PARTIAL_CANCELED → REFUNDED`.

```http
POST /api/payments/:id/confirm
{}
```
> 구매 확정 전용 API. 구매자만 가능하며 `Payment.status=PAID`, `escrowReleased=false`, `Transaction.status=PAID|SHIPPING`에서만 `Transaction.status=COMPLETED`, `Product.status=SOLD`, `escrowReleased=true`로 전이한다(SR-26, SR-27).

```http
POST /api/payments/:id/refund
{ "reason":"거래 취소" }
```
> 구매자 또는 판매자만 가능. `escrowReleased=true` 이후 일반 환불은 제한한다. `PAID` 환불은 Toss cancel API를 호출하고, 성공 시 `Payment.status=REFUNDED`, `Transaction.status=REFUNDED`로 전이한다.

```http
GET /api/payments/:id/receipt
```
> 구매자 또는 판매자만 가능. amount, status, orderId, pgTxId, receiptUrl, paidAt/refundedAt, 거래/상품 요약, 공개 사용자 정보만 반환하며 passwordHash/email/phone은 제외한다(SR-30, SR-39).

---

## 7. Reports `/api/reports`

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/` | 사용자/상품 신고(targetType, targetId, reason, description) | 인증 |
| GET | `/me` | 내 신고 내역 | 🔒 본인 |

```http
POST /api/reports
{ "targetType":"PRODUCT", "targetId":"uuid", "reason":"사기 의심", "description":"외부 결제 유도" }
```
> 🔒 `targetType`은 v1에서 `USER|PRODUCT`만 허용한다. `reporterId`, `status`, `adminId`, `role`은 body에서 받지 않고 DTO whitelist로 400 처리한다.
> 🔒 자기 자신 신고와 자기 상품 신고는 400, 존재하지 않는 대상은 404, 같은 reporter/target 중복 신고는 409.

## 8. Blocks `/api/blocks`

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/` | 사용자 차단(blockedUserId) | 인증 |
| DELETE | `/:blockedUserId` | 사용자 차단 해제 | 🔒 본인 차단 관계 |
| GET | `/` | 내 차단 목록 | 🔒 본인 |

> 🔒 `blockerId`는 access token subject에서만 결정한다. 자기 자신 차단은 400. 중복 차단은 기존 Block을 반환한다.
> 🔒 Block 관계가 양방향 중 하나라도 있으면 `createChat`, `sendMessage`, `createTransaction`은 403.

---

## 9. Admin `/api/admin`  (🔒 전부 JwtAuthGuard + RolesGuard: ADMIN)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/reports` | 신고 목록(status, targetType, page, limit) |
| GET | `/reports/:id` | 신고 상세 |
| PATCH | `/reports/:id/status` | 신고 상태 처리(status, adminNote) |
| GET | `/products` | 관리자 상품 목록(status, isHidden, sellerId, q) |
| PATCH | `/products/:id/hide` | 상품 숨김 |
| PATCH | `/products/:id/restore` | 상품 복구 |
| GET | `/users` | 관리자 사용자 목록(status, role, q) |
| PATCH | `/users/:id/suspend` | 사용자 정지 |
| PATCH | `/users/:id/restore` | 사용자 복구 |
| GET | `/logs` | 관리자 조치 로그 |

> 🔒 `/admin/*`는 토큰의 `role==ADMIN`을 서버에서 검사(SR-09, SR-36). URL 직접 접근·`role=ADMIN` 파라미터 주입 모두 차단(SR-15). 모든 조치는 `admin_logs` 기록(SR-28).
> 🔒 일반 사용자는 403. 관리자 목록 응답은 passwordHash, refresh token, Toss secret/key, token, phone/email을 반환하지 않는다.
> 🔒 상품 hide는 `Product.isHidden=true`, `status=HIDDEN`. restore는 기본적으로 `HIDDEN -> ON_SALE`이지만 `RESERVED|PAYMENT_PENDING|PAID|SHIPPING|COMPLETED` 거래가 있으면 재판매 방지를 위해 409.
> 🔒 사용자 suspend는 `User.status=SUSPENDED`, restore는 `ACTIVE`. 자기 자신 정지와 마지막 ACTIVE 관리자 정지는 거부한다.
> 🔒 `GET /admin/logs`는 pagination만 제공하며 로그 수정/삭제 API는 만들지 않는다.

---

## 10. Notifications `/api/notifications`

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/` | 내 알림 | 🔒 본인만 |
| POST | `/:id/read` | 읽음 | 🔒 본인만 |

> 🔒 알림 조회는 `notification.userId == me`(SR-39). 타인 알림 조회 차단.

---

## 11. 공통 보안 정책

- **CORS**: `CORS_ORIGIN`만 허용, credentials true(SR-38)
- **Rate Limit**: 로그인·결제·채팅 송신 엄격 적용(SR-37)
- **Validation**: 전역 `ValidationPipe({ whitelist:true, forbidNonWhitelisted:true })`
- **응답 필터**: 직렬화 시 `@Exclude()`로 passwordHash·내부 필드 제거(SR-39)
- **에러**: 전역 필터로 스택/쿼리 미노출(NFR-07)
- **정지 사용자**: 로그인/refresh와 Products, Chats, Transactions, Payments의 신규 변경 행위는 403/401로 제한한다. 본인 데이터 확인용 읽기 API는 허용한다.
