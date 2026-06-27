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
| POST | `/:id/confirm` | 구매 확정 | 🔒 구매자만 (SR-26) |
| POST | `/:id/refund` | 환불 요청 | 🔒 당사자+상태 검증 (SR-25) |
| GET | `/:id/receipt` | 영수증 | 🔒 당사자만 (SR-30) |

```http
POST /api/payments
{ "transactionId":"...", "idempotencyKey":"uuid-v4" }
```
> 🔒 **금액은 요청 본문에서 받지 않는다.** 서버가 `transaction → product.price`로 재계산(SR-22).
> 🔒 `idempotencyKey` UNIQUE로 중복 결제 차단(SR-24).
```http
POST /api/payments/webhook
Headers: X-PG-Signature: <hmac-sha256>
{ "pgTxId":"...", "status":"PAID", "amount":300000 }
```
> 🔒 `HMAC-SHA256(body, PG_WEBHOOK_SECRET)` 비교 후에만 PAID 반영. 서명 불일치 → 401(SR-23).
> 🔒 정산은 `confirm` 이후에만(`escrowReleased=true`)(SR-27).

---

## 7. Reports `/api/reports`

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/` | 신고(type, targetId, reason) | 인증 |
| GET | `/mine` | 내 신고 내역 | 🔒 본인 |

---

## 8. Admin `/api/admin`  (🔒 전부 RolesGuard: ADMIN)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/reports` | 신고 목록(신고자 PII 비노출) |
| PATCH | `/reports/:id` | 신고 상태 처리 |
| PATCH | `/products/:id/hide` | 상품 숨김 |
| PATCH | `/users/:id/sanction` | 제재(경고/정지/영구정지) |
| GET | `/logs` | 관리자 조치 로그 |

> 🔒 `/admin/*`는 토큰의 `role==ADMIN`을 서버에서 검사(SR-09, SR-36). URL 직접 접근·`role=ADMIN` 파라미터 주입 모두 차단(SR-15). 모든 조치는 `admin_logs` 기록(SR-28).
> 🔒 관리자 상태 변경 요청은 CSRF 토큰/SameSite로 보호.

---

## 9. Notifications `/api/notifications`

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/` | 내 알림 | 🔒 본인만 |
| POST | `/:id/read` | 읽음 | 🔒 본인만 |

> 🔒 알림 조회는 `notification.userId == me`(SR-39). 타인 알림 조회 차단.

---

## 10. 공통 보안 정책

- **CORS**: `CORS_ORIGIN`만 허용, credentials true(SR-38)
- **Rate Limit**: 로그인·결제·채팅 송신 엄격 적용(SR-37)
- **Validation**: 전역 `ValidationPipe({ whitelist:true, forbidNonWhitelisted:true })`
- **응답 필터**: 직렬화 시 `@Exclude()`로 passwordHash·내부 필드 제거(SR-39)
- **에러**: 전역 필터로 스택/쿼리 미노출(NFR-07)
