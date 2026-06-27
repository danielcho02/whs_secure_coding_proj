# 시스템 아키텍처 (Architecture)

## 1. 전체 구성

```
                 ┌─────────────────────────────────────┐
   Browser ─────▶│  React + Vite (SPA)                  │
   (PC/Mobile)   │  - 액세스 토큰: 메모리 보관           │
                 │  - 리프레시 토큰: httpOnly 쿠키       │
                 └───────────────┬─────────────────────┘
                                 │ HTTPS / WSS
                                 ▼
                 ┌─────────────────────────────────────┐
                 │  NestJS API Gateway                  │
                 │  ┌─────────────────────────────────┐ │
                 │  │ Global: Helmet, CORS, RateLimit  │ │
                 │  │ Pipe: ValidationPipe(whitelist)  │ │
                 │  │ Guard: JwtAuth → Roles → Owner   │ │
                 │  │ Interceptor: ResponseFilter, Log │ │
                 │  │ Filter: GlobalExceptionFilter    │ │
                 │  └─────────────────────────────────┘ │
                 │  Modules: auth/users/products/chats/ │
                 │           transactions/payments/...  │
                 └────┬───────────────┬─────────────┬───┘
                      │               │             │
              ┌───────▼──┐   ┌────────▼───┐  ┌──────▼─────┐
              │PostgreSQL│   │   Redis    │  │ File Store │
              │ (Prisma) │   │ rate/사session│  │ /uploads   │
              └──────────┘   │ /토큰화이트  │  │ (실행불가)  │
                             └────────────┘  └────────────┘
                                 ▲
                      ┌──────────┴──────────┐
                      │  PG사 (결제) Webhook │  ── 서명 검증
                      └─────────────────────┘
```

---

## 2. 요청 처리 파이프라인 (보안 게이트)

NestJS 요청은 다음 순서로 통과한다. **이 순서가 접근제어의 핵심**이다.

```
요청
 → Helmet (보안 헤더)
 → CORS (허용 Origin만, SR-38)
 → RateLimit (SR-37)
 → ValidationPipe(whitelist:true) — DTO 외 필드 제거 (Mass Assignment 방어, SR-15)
 → JwtAuthGuard — 인증 확인 (SR-34)
 → RolesGuard — 역할 검사 (SR-05, SR-09, SR-36)
 → OwnershipGuard — 객체 소유자/참여자 검증 (SR-06,07,08,10,35) ★ BOLA 방어
 → Controller → Service
 → Interceptor: 응답 필드 필터 (SR-39) + 감사 로그 (NFR-04)
 → 예외 시 GlobalExceptionFilter — 내부 메시지 은폐 (NFR-07)
```

> **핵심 설계 원칙**: 권한 검사는 **항상 서버에서, 데이터 접근 직전에**. 클라이언트가 보낸 `userId`/`role`/`price`는 절대 신뢰하지 않고 토큰의 주체(sub)와 DB 값으로만 판단한다.

---

## 3. 인증/세션 흐름

### 로그인
```
1. POST /auth/login (email, password)
2. 서버: bcrypt.compare → 실패 시 Redis 카운터++ (5회 초과 → 잠금, SR-02)
3. 성공: 액세스 토큰(15m) 발급 → 응답 본문
        리프레시 토큰(7d) 발급 → Set-Cookie: HttpOnly; Secure; SameSite=Strict
        리프레시 토큰 jti를 Redis 화이트리스트에 저장
```

### 토큰 갱신 (회전)
```
1. POST /auth/refresh (쿠키의 리프레시 토큰)
2. 서버: jti가 Redis 화이트리스트에 있는지 확인
3. 있으면 → 기존 jti 폐기, 새 액세스+리프레시 발급(회전)
4. 없으면(재사용 탐지) → 해당 사용자 전체 토큰 무효화 (탈취 대응)
```

### 로그아웃 (SR-04)
```
POST /auth/logout → Redis 화이트리스트에서 jti 제거 + 쿠키 삭제
```

> 액세스 토큰을 localStorage가 아닌 메모리에 두므로 Stored XSS로 토큰을 긁어가기 어렵고, 서버 화이트리스트로 즉시 무효화가 가능하다.

---

## 4. 도메인 분리 (NFR-03)

| 도메인 | 책임 | 주요 엔티티 |
|--------|------|------------|
| auth | 인증·토큰 | (RefreshToken in Redis) |
| users | 프로필·신뢰도·계정상태 | User |
| products | 상품·이미지·검색·찜 | Product, ProductImage, Favorite |
| chats | 채팅방·메시지·차단 | Chat, ChatMessage, Block |
| transactions | 거래·후기 | Transaction, Review |
| payments | 결제·에스크로·환불·정산·웹훅 | Payment |
| reports | 신고 | Report |
| admin | 신고처리·제재·로그 | AdminLog |
| notifications | 알림 | Notification |

각 도메인은 독립 모듈로 분리하여 결합도를 낮추고, 향후 서비스 분리·확장이 가능하도록 한다.

---

## 5. 거래 상태 머신

```
요청됨(REQUESTED)
   │ 판매자 예약
   ▼
예약중(RESERVED)
   │ 구매자 결제 요청
   ▼
결제대기(PAYMENT_PENDING)
   │ PG 웹훅(서명검증) 성공
   ▼
결제완료(PAID) ──(에스크로 보관, 정산 보류)──
   │ 배송
   ▼
배송중(SHIPPING)
   │ 구매자 구매 확정
   ▼
완료(COMPLETED) ──▶ 판매자 정산 + 후기 작성 가능

취소(CANCELLED) / 환불(REFUNDED) — 상태·당사자 검증 후에만 전이
```

> 상태 전이는 **서버에서 현재 상태와 행위자 권한을 검증**한 뒤에만 허용한다. 클라이언트가 보낸 목표 상태를 그대로 적용하지 않는다(SR-08, SR-15, SR-26).

---

## 6. 결제 흐름 (안전거래)

```
1. POST /payments (transactionId, idempotencyKey)
   - 서버가 transaction → product.price 조회하여 금액 재계산 (SR-22)
   - idempotencyKey로 중복 결제 차단 (SR-24)
   - 상태 PAYMENT_PENDING
2. PG사 결제 → Webhook POST /payments/webhook
   - HMAC 서명 검증 (PG_WEBHOOK_SECRET, SR-23)
   - 검증 성공 시에만 PAID 전이
3. 에스크로: PAID여도 판매자 정산 보류 (SR-33)
4. 구매자 구매 확정 → COMPLETED → 판매자 정산 (SR-27, SR-35)
5. 모든 결제/환불/정산 → 감사 로그 (SR-28)
```

---

## 7. WebSocket(채팅) 인증

```
1. 클라이언트 connect 시 액세스 토큰 전달 (auth payload)
2. 게이트웨이 handshake에서 토큰 검증 (SR-34)
3. 채팅방 join 시 참여자 여부 DB 검증 (SR-07) ★ 채팅 IDOR 방어
4. 메시지 송신 시 발신자=참여자 확인, 메시지 본문 escape (SR-13)
```

---

## 8. 로깅/감사 (NFR-04, SR-28, SR-31)

- 로그인, 결제, 환불, 정산, 관리자 조치 → `audit_logs` / `admin_logs` 적재
- 로그에 **비밀번호·토큰·계좌번호 저장 금지**
- 관리자 로그는 append-only로 다루어 위변조 방지(이상적으로 해시 체인)
