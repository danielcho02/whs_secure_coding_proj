# Race Condition

## 1. 취약점 개요

Race Condition은 같은 상품에 여러 구매자가 동시에 예약/결제를 시도할 때 중복 판매가 발생하는 문제다. 현재 main은 거래 예약과 결제 상태 전이를 Prisma transaction과 조건부 update로 방어한다. `e180546`에서 동시 예약 테스트가 추가되었다. 이 항목은 **위협 분석 및 방어 검증**이다.

## 2. OWASP 분류

- OWASP Top 10: A04 Insecure Design
- 관련 요구사항: SR-08, SR-15, SR-24, SR-26

## 3. 위협 및 공격 시나리오

- 판매자가 같은 상품의 두 거래 요청을 거의 동시에 예약 처리한다.
- 두 요청이 모두 `Product.status=ON_SALE`로 보고 `RESERVED`를 만들어 중복 판매가 된다.
- 결제 pending/paid 상태와 상품 reserved 상태가 서로 어긋난다.

## 4. 영향받는 기능/API

- `PATCH /api/transactions/:id/reserve`
- `PATCH /api/transactions/:id/cancel`
- `PATCH /api/transactions/:id/complete`
- `POST /api/payments`
- `POST /api/payments/:id/confirm`
- `POST /api/payments/:id/refund`

## 5. 기존 구현 분석

예약 처리에서는 transaction 조회 후 같은 상품의 점유 거래를 확인하고, 상품 상태를 조건부 update한다. update count가 1이 아니면 충돌로 처리한다.

```ts
const productUpdate = await tx.product.updateMany({
  where: { id: transaction.productId, isHidden: false, status: ProductStatus.ON_SALE },
  data: { status: ProductStatus.RESERVED },
});
```

## 6. 패치 또는 방어 구현

- 예약/취소/완료는 Prisma `$transaction` 안에서 처리한다.
- 상품 상태와 거래 상태를 각각 조건부 update한다.
- update count가 0이면 상태가 바뀐 것으로 보고 Conflict를 반환한다.
- 결제 생성도 거래 상태를 `RESERVED|PAYMENT_PENDING`에서만 `PAYMENT_PENDING`으로 전이한다.
- 구매 확정은 payment와 transaction/product 상태를 한 transaction에서 갱신한다.

## 7. 핵심 코드와 파일 경로

- `backend/src/modules/transactions/transactions.service.ts`
- `backend/src/modules/transactions/transactions-race.spec.ts`
- `backend/src/modules/payments/payments.service.ts`
- `backend/prisma/schema.prisma`

핵심 코드:

```ts
if (productUpdate.count !== 1) {
  throw new ConflictException('Product is not available');
}
```

## 8. 자동 테스트

- `backend/src/modules/transactions/transactions-race.spec.ts`
  - 같은 상품의 두 `REQUESTED` 거래를 동시에 예약
  - 결과는 1건 fulfilled, 1건 rejected
  - rejected reason은 `ConflictException`
  - 상품 상태는 `RESERVED`
  - 두 거래 중 하나만 `RESERVED`
  - 실패 경로에서 `transaction.create`, `payment.create` 미호출

## 9. 브라우저 QA

요청에는 거래 예약 503 재현이 언급되었지만, 저장소의 커밋/문서/grep에서 503 직접 기록은 확인되지 않았다. 현재 문서에서는 503을 Race Condition 증거로 사용하지 않았다.

거래 UI 쪽에서는 `6ee3585`, `73f5e56`, `e180546`, `981dfc3`에서 terminal 상태, 안전결제 action, seller complete action이 반복 수정되었다. 이는 동시성 취약점이라기보다 상태별 UI 흐름 오류다.

## 10. Git 패치 기록

- `318c7ca`: 거래 상태 머신과 조건부 상태 전이 구현
- `83b1967`: 결제 상태 전이와 escrow 구현
- `6ee3585`: terminal 거래 UI 수정
- `e180546`: 동시 예약 race 테스트 추가
- `981dfc3`: 거래 상세 role/action 리뷰 후속

## 11. 패치 전후 비교

| 구분 | 위험한 방식 | 현재 방식 |
|---|---|---|
| 예약 | 상태 확인 후 무조건 update | `status=ON_SALE` 조건부 update |
| 거래 전이 | 목표 status를 body로 받음 | 서버 상태 머신 |
| 결제 생성 | 중복 요청마다 payment 생성 | transaction/payment unique + idempotency |
| 구매 확정 | payment만 갱신 | payment, transaction, product 동시 갱신 |

## 12. 잔존 위험

- 현재 race 테스트는 service-level mock 기반이다. 실제 PostgreSQL 격리수준과 네트워크 동시 요청 e2e는 추가할 수 있다.
- 결제 승인과 웹훅이 동시에 들어오는 경우에 대한 더 강한 통합 테스트가 필요하다.
- 분산 환경에서 worker가 여러 대가 되면 DB transaction과 unique 제약 외에 idempotency 저장소 모니터링이 필요하다.

## 13. 향후 개선

- Testcontainers 기반 DB 동시성 테스트를 추가한다.
- 결제 approve와 webhook 동시 도착 시나리오를 추가한다.
- 상품 상태 전이 이벤트를 감사 로그로 남겨 운영 추적성을 높인다.
