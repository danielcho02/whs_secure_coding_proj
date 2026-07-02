# Rate Limit 및 민감정보 노출

## 1. 취약점 개요

이 항목은 두 가지를 다룬다. 첫째, 로그인/결제/채팅 같은 비용 높은 API의 요청 제한이다. 둘째, 응답이나 로그에 비밀번호 해시, 내부 세션 값, 결제 secret, 연락처 같은 민감정보가 노출되는 문제다.

민감정보 응답 제한은 여러 도메인에서 구현과 테스트가 확인된다. Rate Limit은 로그인 실패 잠금과 `ThrottlerModule` 설정은 확인되지만, `ThrottlerGuard` 전역 등록 또는 route별 429 테스트는 확인되지 않아 **부분 검증**으로 분류한다.

## 2. OWASP 분류

- OWASP Top 10: A01 Broken Access Control, A02 Cryptographic Failures, A07 Identification and Authentication Failures
- OWASP API Security Top 10: API4 Unrestricted Resource Consumption
- 관련 요구사항: SR-02, SR-29, SR-30, SR-31, SR-37, SR-39

## 3. 위협 및 공격 시나리오

- 로그인 brute force로 계정 비밀번호를 추측한다.
- 결제/웹훅/채팅 API에 대량 요청을 보내 외부 비용 또는 서버 자원을 소비시킨다.
- 상품/채팅/거래/관리자 응답에서 비밀번호 해시, 내부 token, 결제 secret, 연락처가 노출된다.
- seed 또는 로그가 민감정보를 출력한다.

## 4. 영향받는 기능/API

- Auth login/refresh
- Products seller response
- Chats user response
- Transactions buyer/seller/payment summary
- Payments receipt/checkout response
- Reports/Admin/Notifications response
- Seed/로그/환경 설정

## 5. 기존 구현 분석

로그인 실패는 Redis counter와 DB lock field를 함께 사용한다. 사용자 응답은 대부분 Prisma `select`로 공개 필드만 선택한다.

예:

```ts
const PUBLIC_USER_SELECT = {
  id: true,
  nickname: true,
  avatarUrl: true,
  trustScore: true,
  completedTx: true,
};
```

그러나 `ThrottlerModule` 설정만으로 실제 rate limiting이 적용되는지는 충분하지 않다. 현재 코드에서 `ThrottlerGuard`, `APP_GUARD`, `@Throttle` 사용은 확인되지 않았다.

## 6. 패치 또는 방어 구현

- 로그인 실패 횟수 증가 및 일정 횟수 도달 시 잠금
- 인증/프로필 응답에서 passwordHash 제외
- 상품/채팅/거래/관리자 응답에서 공개 사용자 select 사용
- 결제 receipt는 당사자만 조회 가능하고 공개 사용자 정보만 반환
- Notification은 `id`, type, message/body, read 상태, target 정도만 반환
- 실제 live key 패턴은 코드/문서 생성 보고서에 기록하지 않음

## 7. 핵심 코드와 파일 경로

- `backend/src/modules/auth/auth.service.ts`
- `backend/src/app.module.ts`
- `backend/src/modules/products/products.service.ts`
- `backend/src/modules/chats/chats.service.ts`
- `backend/src/modules/transactions/transactions.service.ts`
- `backend/src/modules/payments/payments.service.ts`
- `backend/src/modules/admin/admin.service.ts`
- `backend/src/modules/notifications/notifications.service.ts`

Rate limit 설정:

```ts
ThrottlerModule.forRootAsync({
  useFactory: (configService) => [{
    ttl: configService.get('security.rateLimitWindow'),
    limit: configService.get('security.rateLimitMax'),
  }],
})
```

## 8. 자동 테스트

- `auth.service.spec.ts`: 로그인 실패 counter, lock, generic failure
- `payments.service.spec.ts`: receipt participant 제한과 민감 사용자 필드 제외
- `transactions.service.spec.ts`: payment summary 제한
- `admin-security.spec.ts`: 관리자 목록/로그 응답과 AdminLog 동작
- 정적 검색: production `passwordHash` 응답 선택은 주요 공개 응답에서 제외

최신 전체 테스트는 42 files / 292 tests 통과다.

## 9. 브라우저 QA

`e180546`에서 준비 중 UI와 소셜 로그인 placeholder를 제거하고, demo login 관련 소스 평문 노출 위험을 낮추었다. 단, 기존 README와 seed에는 개발용 계정 정보가 있으므로 이 보고서에는 해당 값을 기록하지 않았다.

## 10. Git 패치 기록

- `0296390`: 로그인 실패 잠금, safe auth response
- `4fa47c2`: admin response 민감정보 제한
- `8a1982f`: notification response 제한
- `291211a`/`692c91b`: 거래 상세, 내 상품, 찜 목록 응답 제한 테스트/구현
- `e180546`: mock/placeholder UI 제거, config 테스트 보강

## 11. 패치 전후 비교

| 구분 | 이전 위험 | 현재 상태 |
|---|---|---|
| 로그인 brute force | 반복 시도 가능 | 실패 counter + lock 구현 |
| 전역 rate limit | 설정 누락 가능 | 설정값은 있으나 guard 적용 검증 부족 |
| 사용자 응답 | email/phone/hash 노출 위험 | 공개 select 중심 |
| 결제 receipt | 타인 조회/민감정보 위험 | participant check + 공개 사용자 필드 |
| seed/log | 실제 secret 노출 위험 | 테스트 값/placeholder 중심, 이 보고서에는 값 미기록 |

## 12. 잔존 위험

- 실제 route-level 429 테스트가 없다.
- `ThrottlerGuard` 전역 등록이 확인되지 않아 Nest rate limit 적용은 부분 검증이다.
- 로그 수집 시스템에서 민감정보 masking을 강제하는 운영 통제는 별도 필요하다.
- admin list는 운영상 email이 필요해질 수 있는데, 현재는 최소 공개 필드 중심이다. 요구 변경 시 개인정보 영향 평가가 필요하다.

## 13. 향후 개선

- `APP_GUARD`로 `ThrottlerGuard`를 등록하거나 중요 route별 `@Throttle`을 적용한다.
- 로그인, 결제 생성, 채팅 송신, 웹훅에 429 e2e를 추가한다.
- 로그 redaction middleware를 추가한다.
- 개인정보 필드 접근을 감사 로그와 연결한다.
