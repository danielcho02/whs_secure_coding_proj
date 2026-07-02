# 결제 금액 조작

## 1. 취약점 개요

결제 금액 조작은 클라이언트가 결제 요청의 amount를 낮추거나 거래 금액/status를 조작해 실제 상품 가격보다 적은 금액으로 결제 상태를 만들려는 문제다. 현재 main은 거래와 결제 모두 서버 DB 값을 기준으로 금액을 결정한다. 이 항목은 **위협 분석 및 방어 검증**이며, 일부 UI/운영 설정 후속 패치는 `981dfc3`에서 확인된다.

## 2. OWASP 분류

- OWASP Top 10: A01 Broken Access Control, A04 Insecure Design
- OWASP API Security Top 10: API3 Broken Object Property Level Authorization
- 관련 요구사항: SR-15, SR-22, SR-24, SR-26, SR-27, SR-35

## 3. 위협 및 공격 시나리오

- `POST /api/transactions`에 `amount`, `sellerId`, `status`를 끼워 넣는다.
- `POST /api/payments`에 낮은 `amount`를 넣어 결제 생성을 시도한다.
- Toss 승인 callback에서 amount를 낮춰 보낸다.
- 결제 완료 전/후 상태를 조작해 escrow release 또는 환불 제한을 우회한다.

## 4. 영향받는 기능/API

- `POST /api/transactions`
- `PATCH /api/transactions/:id/reserve|cancel|complete`
- `POST /api/payments`
- `POST /api/payments/:id/approve`
- `POST /api/payments/:id/confirm`
- `POST /api/payments/:id/refund`

## 5. 기존 구현 분석

거래 생성 DTO는 `productId`만 받는다. 서비스는 상품을 DB에서 조회하고 `product.price`를 `Transaction.amount`로 저장한다.

```ts
data: {
  productId: product.id,
  buyerId,
  sellerId: product.sellerId,
  amount: product.price,
  status: TxStatus.REQUESTED,
}
```

결제 생성 DTO도 `transactionId`, `idempotencyKey`만 받는다. 결제 서비스는 `Transaction.amount`와 `Product.price`가 다르면 결제 생성을 거부한다.

## 6. 패치 또는 방어 구현

- 거래 amount는 상품 DB 가격에서 복사한다.
- 결제 amount는 거래 DB 금액으로 저장한다.
- 거래 amount와 상품 가격이 어긋나면 결제 생성을 중단한다.
- 결제 승인 요청의 orderId와 amount를 DB Payment와 대조한다.
- provider 승인 결과의 orderId/amount/status도 다시 대조한다.
- 같은 거래에 다른 idempotency key로 중복 결제하면 409를 반환한다.
- 구매 확정 전에는 escrow를 release하지 않는다.
- 판매자 완료 API는 `RESERVED` 상태를 완료로 전이하지 않으며, `PAID` 또는 `SHIPPING` 거래와 persisted `PAID` payment가 있어야만 완료를 허용한다.
- 신뢰도와 완료 거래 수 증가는 위 완료 조건을 통과한 뒤에만 수행한다.

## 7. 핵심 코드와 파일 경로

- `backend/src/modules/transactions/dto/create-transaction.dto.ts`
- `backend/src/modules/transactions/transactions.service.ts`
- `backend/src/modules/payments/dto/create-payment.dto.ts`
- `backend/src/modules/payments/payments.service.ts`
- `backend/prisma/schema.prisma`: `Payment.transactionId`, `Payment.idempotencyKey`, `Payment.orderId` unique

핵심 코드:

```ts
if (transaction.amount !== transaction.product.price) {
  throw new ConflictException('Transaction amount is inconsistent');
}
```

```ts
if (payment.amount !== dto.amount) {
  throw new BadRequestException('Payment amount mismatch');
}
```

## 8. 자동 테스트

- `backend/src/security-smoke.spec.ts`
  - transaction/payment 권한 필드 mass assignment 거부
  - `amount: 1` 주입에도 Payment.amount는 서버 transaction amount 사용
  - transaction amount와 product price 불일치 시 결제 생성 거부
- `backend/src/modules/payments/payments.service.spec.ts`
  - 결제 생성 buyer 검증
  - idempotency 재요청/중복 결제 거부
  - Toss approve amount mismatch 거부
  - escrow release 및 refund 제한 검증
- `backend/src/modules/transactions/transactions.service.spec.ts`
  - `RESERVED` 거래 완료 시도 거부
  - persisted `PAID` payment 없는 완료 시도 거부
  - `PAID` 거래와 `PAID` payment가 있는 정상 완료에서만 상품 SOLD, 거래 COMPLETED, 신뢰도 증가
  - 권한 없는 사용자 완료 시도 거부

## 9. 브라우저 QA

`981dfc3`에서 결제/거래 리뷰 후속 패치가 반영되었고, 이후 머지 전 리뷰에서 `RESERVED` 상태의 판매자 완료 버튼과 서버 완료 전이가 결제/에스크로 흐름과 충돌하는 문제가 확인되었다. 현재 작업 트리에서는 `RESERVED` 완료를 서버와 프론트 모두에서 차단하도록 수정했다.

- 결제 provider 기본값이 명시적으로 Toss가 되도록 수정
- 거래 상세에서 buyer/seller role을 명확히 판정
- transaction response에 있는 payment summary를 재사용해 결제 action 누락을 줄임
- seller 완료 가능 상태에서 `RESERVED`를 제외하고, 결제 완료 이후 상태만 완료 대상으로 제한

이는 서버 금액 검증 취약점 패치라기보다 UI/운영 설정 위험 보정이다.

## 10. Git 패치 기록

- `318c7ca`: 거래 서버 기준 amount 구현
- `83b1967`: 결제 서버 기준 amount, Toss approve 대조, idempotency 구현
- `e180546`: price tampering smoke test 추가
- `981dfc3`: payment provider 기본값과 거래 상세 action 리뷰 후속
- 현재 작업 트리: 결제 전 `RESERVED` 거래 완료 차단, 완료 전 persisted `PAID` payment 검증 추가

## 11. 패치 전후 비교

| 구분 | 위험한 방식 | 현재 방식 |
|---|---|---|
| 거래 생성 | body amount/status 신뢰 | `product.price`, 서버 상태 사용 |
| 결제 생성 | body amount 신뢰 | `transaction.amount` 사용 |
| 승인 callback | callback amount 신뢰 | DB payment amount와 대조 |
| provider 결과 | PG 응답만 신뢰 | provider 결과와 DB 다시 대조 |
| 중복 결제 | 같은 거래에 여러 결제 생성 | transaction/payment unique + idempotency |
| 거래 완료 | `RESERVED` 거래를 판매자가 바로 완료 | `PAID|SHIPPING` 거래와 `PAID` payment가 있어야 완료 |
| 신뢰도 증가 | 결제 전 완료로 증가 가능 | 정상 완료 조건 통과 후에만 증가 |

## 12. 잔존 위험

- 실제 Toss sandbox 승인/취소는 외부 key와 webhook endpoint가 필요해 자동 테스트에서 provider mock 중심으로 검증했다.
- 상품 가격 변경과 이미 생성된 거래 amount 간 정책은 현재 거래 생성 시점 금액 보존 방식이다. 운영 정책 문서화가 필요하다.
- 부분 취소/부분 환불 같은 복잡한 결제 상태는 현재 범위 밖이다.
- 현재 API에는 명시적인 `SHIPPING` 전이 경로가 없다. 판매자 완료 API는 결제 완료 상태로 제한했지만, 배송 상태 모델은 운영 전 별도 설계가 필요하다.
- 판매자 완료 API와 구매자 구매확정 API가 모두 `COMPLETED` 전이에 관여한다. 현재 에스크로 release의 정식 경로는 구매자 구매확정 API이므로, 운영 전 완료/정산 책임을 단일 상태 머신으로 정리해야 한다.

## 13. 향후 개선

- Toss sandbox test key를 CI secret으로 등록한 통합 테스트 환경을 별도로 둔다.
- 결제/환불 감사 로그를 운영 모니터링과 연결한다.
- 가격 변경 후 기존 예약 거래 정책을 관리자 runbook에 명시한다.
