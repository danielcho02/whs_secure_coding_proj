# Webhook Forgery

## 1. 취약점 개요

Webhook Forgery는 공격자가 결제 완료/취소 웹훅을 위조해 결제 상태를 바꾸는 문제다. 현재 main은 raw body 기반 HMAC 서명 검증을 통과해야 웹훅을 처리하고, 통과 후에도 DB의 결제 금액/상태와 대조한다. 이 항목은 **위협 분석 및 방어 검증**이다.

## 2. OWASP 분류

- OWASP Top 10: A01 Broken Access Control, A04 Insecure Design
- 관련 요구사항: SR-23, SR-24, SR-28

## 3. 위협 및 공격 시나리오

- 공격자가 결제 완료 웹훅 body를 직접 POST한다.
- 서명은 없거나 잘못된 값으로 보낸다.
- 결제 금액을 실제 DB 금액보다 낮게 넣는다.
- 같은 웹훅을 여러 번 보내 중복 상태 전이를 유도한다.

## 4. 영향받는 기능/API

- `POST /api/payments/webhook`
- 결제 상태 전이
- 거래 상태 전이
- escrow/refund 상태
- payment audit log

## 5. 기존 구현 분석

`main.ts`는 Fastify app 생성 시 raw body를 활성화한다. `PaymentsController`는 raw body와 signature/timestamp header를 service에 넘긴다.

`TossWebhookVerifier`는 timestamp와 raw body를 결합해 HMAC-SHA256을 계산하고 timing-safe compare를 사용한다.

## 6. 패치 또는 방어 구현

- 공개 webhook route지만 service에서 HMAC 검증을 강제한다.
- 서명 불일치 시 payment 조회 전에 401을 반환한다.
- webhook payload의 amount가 DB Payment.amount와 다르면 400을 반환한다.
- orderId/paymentKey로 기존 Payment를 찾고, 없으면 무시한다.
- 이미 같은 상태면 idempotent하게 ignored를 반환한다.
- DONE/PAID, CANCELED 계열, REFUNDED 계열을 내부 상태로 매핑한다.

## 7. 핵심 코드와 파일 경로

- `backend/src/main.ts`
- `backend/src/modules/payments/payments.controller.ts`
- `backend/src/modules/payments/payments.service.ts`
- `backend/src/modules/payments/toss-webhook-verifier.ts`
- `backend/src/modules/payments/toss-webhook-verifier.spec.ts`
- `backend/src/modules/payments/payments.service.spec.ts`

핵심 코드:

```ts
if (!this.webhookVerifier.verify(rawBody, headers)) {
  throw new UnauthorizedException('Invalid payment webhook signature');
}
```

```ts
if (typeof webhookPayload.amount === 'number' && webhookPayload.amount !== payment.amount) {
  throw new BadRequestException('Webhook amount mismatch');
}
```

## 8. 자동 테스트

- `toss-webhook-verifier.spec.ts`
  - 유효한 HMAC signature 수락
  - mismatch signature 거부
- `payments.service.spec.ts`
  - invalid signature는 payment state 조회 전에 401
  - 이미 PAID 상태의 중복 웹훅은 update 없이 ignored
  - amount mismatch는 거부

## 9. 브라우저 QA

웹훅은 브라우저 QA에서 직접 검증하기 어려운 서버-외부 PG 연동 영역이다. `13-testing-and-qa.md`에서는 provider mock과 local mock checkout은 QA 편의를 위한 것이며, 실제 Toss sandbox/webhook endpoint 검증은 외부 환경 의존으로 분리했다.

## 10. Git 패치 기록

- `83b1967`: Toss sandbox adapter, webhook verifier, 결제 상태 처리 구현
- `e180546`: mock provider 모드와 보안 테스트 보강
- `981dfc3`: provider 기본값을 Toss로 조정하고 mock은 명시 설정일 때만 쓰도록 리뷰 후속

## 11. 패치 전후 비교

| 구분 | 위험한 방식 | 현재 방식 |
|---|---|---|
| 웹훅 인증 | body만 신뢰 | raw body HMAC 검증 |
| 금액 | webhook amount 신뢰 | DB amount와 대조 |
| 중복 웹훅 | 반복 update | 같은 상태면 ignored |
| 운영 provider | 개발 mock 기본값 위험 | 기본 Toss, mock은 명시 설정 |

## 12. 잔존 위험

- 실제 Toss sandbox webhook endpoint에서의 end-to-end 검증은 수행하지 않았다.
- timestamp freshness window 검증은 현재 HMAC 입력으로 사용하지만 시간 허용 범위 검사는 코드에서 보이지 않는다.
- webhook replay 방지를 위한 eventId 저장/중복 차단 테이블은 없다.

## 13. 향후 개선

- timestamp 허용 범위와 eventId replay cache를 추가한다.
- 실제 Toss sandbox webhook을 ngrok 또는 배포 테스트 환경에서 검증한다.
- webhook 처리 결과와 audit log를 보안 모니터링에 연결한다.
