# Mass Assignment

## 1. 취약점 개요

Mass Assignment는 클라이언트가 DTO에 없는 권한 필드나 상태 필드를 body/query에 넣었을 때 서버가 이를 그대로 반영하는 문제다. 현재 main은 전역 `ValidationPipe`에서 whitelist와 non-whitelist 거부를 사용하고, DTO 자체도 권한 필드를 포함하지 않는다. 이 항목은 **위협 분석 및 방어 검증**이다.

## 2. OWASP 분류

- OWASP API Security Top 10: API3 Broken Object Property Level Authorization
- OWASP Top 10: A01 Broken Access Control
- 관련 요구사항: SR-11, SR-15, SR-39

## 3. 위협 및 공격 시나리오

- 회원가입/프로필 수정에 `role=ADMIN`을 넣는다.
- 상품 등록/수정에 `sellerId`, `isHidden`, `status`를 넣는다.
- 거래 요청에 `buyerId`, `sellerId`, `amount`, `status`를 넣는다.
- 결제 생성에 `amount`, `userId`, `status`, `escrowReleased`를 넣는다.
- 관리자 신고 처리 DTO에 `adminId`, `reporterId`, `role`을 넣는다.
- WebSocket message payload에 `senderId`, `userId`, `role`을 넣는다.

## 4. 영향받는 기능/API

거의 모든 쓰기 API가 대상이다.

- Auth/users
- Products
- Chats/WS
- Transactions/reviews
- Payments
- Reports/blocks
- Admin moderation
- Notifications read

## 5. 기존 구현 분석

전역 파이프가 다음 설정으로 적용되어 있다.

```ts
new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
})
```

DTO도 권한 필드를 포함하지 않는다. 예를 들어 거래 생성 DTO는 `productId`만 받는다.

```ts
export class CreateTransactionDto {
  @IsUUID('4')
  productId!: string;
}
```

## 6. 패치 또는 방어 구현

- controller는 `@CurrentUser()`의 인증 사용자 ID를 서비스에 전달한다.
- 서비스는 buyer/seller/amount/status를 DB 값과 상태 머신으로 결정한다.
- WS gateway도 `plainToInstance`와 `validateOrReject`에서 whitelist와 non-whitelist 거부를 사용한다.
- 관리자 DTO는 reason/status/adminNote 같은 허용 필드만 포함한다.

## 7. 핵심 코드와 파일 경로

- `backend/src/main.ts`
- `backend/src/modules/products/dto/*.dto.ts`
- `backend/src/modules/transactions/dto/*.dto.ts`
- `backend/src/modules/payments/dto/*.dto.ts`
- `backend/src/modules/admin/dto/*.dto.ts`
- `backend/src/modules/chats/chats.gateway.ts`

핵심 WS 검증:

```ts
await validateOrReject(dto, {
  whitelist: true,
  forbidNonWhitelisted: true,
});
```

## 8. 자동 테스트

- `backend/src/security-smoke.spec.ts`: transaction/payment 권한 필드 주입 거부
- `backend/src/modules/products/dto/product.dto.spec.ts`: sellerId/status/isHidden/userId 주입 거부
- `backend/src/modules/transactions/dto/transactions.dto.spec.ts`: buyerId/sellerId/amount/status 등 주입 거부
- `backend/src/modules/payments/dto/payments.dto.spec.ts`: amount/user/status 주입 거부
- `backend/src/modules/admin/admin-security.spec.ts`: admin DTO role/status/adminId/reporterId 주입 거부
- `backend/src/modules/chats/chats-ws-security.spec.ts`: WS senderId/userId/role 주입 거부

## 9. 브라우저 QA

브라우저 QA에서 직접 Mass Assignment 취약점이 발견되었다는 기록은 없다. 대신 미연결 UI, 상품 등록 validation, 결제/거래 action 오류를 수정하면서 실제 API payload가 DTO와 맞게 정리되었다.

## 10. Git 패치 기록

- `ed10555`: 전역 ValidationPipe 기반 마련
- `0296390`: auth/users DTO 검증
- `f29b135`: product DTO 검증
- `318c7ca`: transaction DTO 검증
- `83b1967`: payment DTO 검증
- `4fa47c2`: report/admin DTO 검증
- `e180546`: smoke/admin/WS mass assignment 테스트 추가

## 11. 패치 전후 비교

| 구분 | 위험한 방식 | 현재 방식 |
|---|---|---|
| role/status | body 필드 반영 | DTO에 없음, non-whitelist 400 |
| seller/buyer | body ID 반영 | 인증 사용자와 DB 관계로 계산 |
| amount | body 금액 반영 | DB 가격/거래 금액으로 계산 |
| WS sender | payload senderId 반영 | socket 인증 사용자 사용 |

## 12. 잔존 위험

- 신규 DTO 추가 시 같은 규칙을 지키지 않으면 회귀할 수 있다.
- Prisma update에 DTO를 직접 spread하는 패턴은 현재 주요 서비스에서 피하고 있지만, 코드 리뷰 규칙으로 계속 감시해야 한다.
- query DTO의 enum/boolean 변환은 e2e에서 더 보강할 수 있다.

## 13. 향후 개선

- CI에 DTO non-whitelist 테스트 생성 규칙을 추가한다.
- 서비스에서 Prisma update data를 명시적 mapper로만 만들도록 lint 또는 리뷰 체크리스트를 강화한다.
- 신규 API마다 “권한 필드를 받지 않는가” 항목을 PR template에 추가한다.
