# IDOR / BOLA

## 1. 취약점 개요

IDOR/BOLA는 사용자가 객체 ID를 바꿔 타인의 채팅, 거래, 결제, 알림, 신고 내역을 조회하거나 변경하는 문제다. 현재 main에서 타인 객체 접근을 허용하는 production 코드는 확인하지 못했다. 이 항목은 주로 **위협 분석 및 방어 검증**으로 작성한다.

단, 정지 사용자 기존 인증 재사용 문제는 접근제어 전반에 영향을 주는 실제 패치 항목이므로 `10-csrf-and-session-security.md`와 함께 다룬다.

## 2. OWASP 분류

- OWASP Top 10: A01 Broken Access Control
- OWASP API Security Top 10: API1 Broken Object Level Authorization
- 관련 요구사항: SR-06, SR-07, SR-08, SR-10, SR-35

## 3. 위협 및 공격 시나리오

- 구매자가 URL의 거래 ID를 타인의 거래 ID로 바꿔 거래 금액, 결제 상태, 상대 사용자 정보를 조회한다.
- 채팅 참여자가 아닌 사용자가 WebSocket `join` 또는 `message` payload의 `chatId`를 조작해 다른 방에 들어간다.
- 알림 ID를 바꿔 타인의 알림을 읽음 처리한다.
- 내 상품/찜 목록 API에 `sellerId` 또는 `userId` query를 넣어 다른 사용자의 데이터를 조회하려 한다.

## 4. 영향받는 기능/API

- `GET /api/chats/:id`, `GET /api/chats/:id/messages`, `POST /api/chats/:id/messages`
- WebSocket `/ws`의 `join`, `message`, `read`
- `GET /api/transactions`, `GET /api/transactions/:id`
- `GET /api/payments/:id/receipt`
- `GET /api/notifications`, `POST /api/notifications/:id/read`
- `GET /api/products/me`, `GET /api/users/me/favorites`

## 5. 기존 구현 분석

현재 구현은 객체 ID를 받은 뒤 서비스 계층에서 DB의 소유자/참여자 필드와 현재 인증 사용자를 비교한다.

예를 들어 거래 상세는 조회 후 buyer/seller가 아니면 같은 404를 반환한다.

```ts
if (transaction.buyer.id !== userId && transaction.seller.id !== userId) {
  throw new NotFoundException('Transaction not found');
}
```

채팅은 `assertParticipant`가 buyer/seller가 아니면 403을 던지고, WebSocket gateway도 `join` 전에 같은 서비스를 호출한다.

## 6. 패치 또는 방어 구현

- 상품 수정/삭제/이미지 업로드: `product.sellerId === currentUser.id` 검증
- 채팅: REST와 WS 모두 `buyerId` 또는 `sellerId` 참여자 검증
- 거래: buyer/seller만 조회, seller만 예약/완료, buyer/seller만 취소/후기
- 결제 영수증: 거래 당사자만 조회
- 알림: `where: { id, userId }` 조건으로 본인 알림만 읽음 처리
- gap API 패치: `692c91b`에서 `GET /api/transactions/:id`, `GET /api/products/me`, `GET /api/users/me/favorites`를 currentUser 기준으로 구현했다.

## 7. 핵심 코드와 파일 경로

- `backend/src/modules/chats/chats.service.ts`: `assertParticipant`, `assertChatParticipant`
- `backend/src/modules/chats/chats.gateway.ts`: WS `join/message/read` 전 참여자 검증
- `backend/src/modules/transactions/transactions.service.ts`: `getTransactionForParticipant`, `buildListWhere`
- `backend/src/modules/payments/payments.service.ts`: receipt participant check
- `backend/src/modules/notifications/notifications.service.ts`: `userId` 조건 조회
- `backend/src/modules/products/products.service.ts`: `assertProductSeller`, `listMyProducts`

핵심 예시:

```ts
const where = { OR: [{ buyerId: userId }, { sellerId: userId }] };
```

## 8. 자동 테스트

- `backend/src/security-smoke.spec.ts`: 비참여자의 거래 상세 접근을 `NotFoundException`으로 검증
- `backend/src/modules/chats/chats-ws-security.spec.ts`: 비참여자 WS join/message 거부
- `backend/src/modules/notifications/notifications.service.spec.ts`: 타인 알림 read 404
- `backend/src/modules/transactions/transactions.service.spec.ts`: 거래 목록/상세 참여자 검증
- `backend/src/modules/users/users.service.spec.ts`: 찜 목록 currentUser 기준 검증

최신 전체 결과는 42 files / 292 tests 통과다.

## 9. 브라우저 QA

브라우저 QA에서 거래 상세, 내 상품, 찜 목록이 degraded UI로 남아 있다는 문제가 확인되어 gap API와 프론트 연결이 보강되었다. 이는 보안 취약점이라기보다 실제 API 연결 누락이었고, 보강 시 currentUser 기준 접근제어를 함께 테스트했다.

## 10. Git 패치 기록

- `21b20b9`: 채팅 참여자 검증 구현
- `318c7ca`: 거래 당사자 검증 구현
- `291211a`: gap API 보안 테스트 추가
- `692c91b`: 거래 상세/내 상품/찜 목록 API 구현
- `e180546`: 보안 smoke 및 WS BOLA 테스트 추가

## 11. 패치 전후 비교

| 구분 | 이전 위험 | 현재 구현 |
|---|---|---|
| 거래 상세 | ID만 알면 조회 가능한 구조가 생길 수 있음 | buyer/seller가 아니면 404 |
| 채팅 WS | payload chatId 조작으로 room join 가능성 | join/message 전 서비스 참여자 검증 |
| 내 상품/찜 | query userId/sellerId 주입 가능성 | currentUser.id만 사용 |
| 알림 읽음 | 타인 알림 ID 조작 가능성 | `id + userId` 조건 조회 |

## 12. 잔존 위험

- 브라우저 기반 Socket.IO room 수신 범위 e2e는 아직 자동화되어 있지 않다.
- 관리자 HTTP e2e는 reflection/unit 중심이라 실제 네트워크 요청 기반 403 캡처가 추가되면 더 좋다.
- 추측 가능한 UUID는 아니지만, 로그/모니터링에서 반복 ID probing 탐지는 별도 운영 통제가 필요하다.

## 13. 향후 개선

- Playwright 또는 API e2e로 타인 객체 접근 시나리오를 실제 HTTP 레벨에서 고정한다.
- 객체 접근 실패 로그를 보안 이벤트로 집계한다.
- WebSocket client 기반 e2e를 추가해 room broadcast 범위를 검증한다.
