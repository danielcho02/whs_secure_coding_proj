# 보안 테스트 계획 초안

## 1. 자동화 테스트 후보

| 테스트 항목 | 목적 | 관련 취약점 | 예상 결과 | 현재 테스트 존재 여부 | 추가 필요 파일 |
|---|---|---|---|---|---|
| 타인 채팅방 상세 조회 차단 | 채팅 IDOR/BOLA 방어 확인 | IDOR / BOLA | 비참여자는 403 또는 404 | `chats.service.spec.ts`, `chats.controller.spec.ts` 일부 있음 | `backend/test/e2e/chats-security.e2e-spec.ts` |
| 타인 거래 상세 조회 차단 | 거래 상세 객체 접근 제어 확인 | IDOR / BOLA | 비당사자는 404 | `transactions.service.spec.ts`, `transactions.controller.spec.ts` 일부 있음 | `backend/test/e2e/transactions-security.e2e-spec.ts` |
| 타인 결제 영수증 조회 차단 | 결제 receipt 접근 제어 확인 | IDOR / BOLA, 민감정보 노출 | 비당사자는 403 | `payments.service.spec.ts`, `payments.controller.spec.ts` 일부 있음 | `backend/test/e2e/payments-security.e2e-spec.ts` |
| 타인 알림 읽음 처리 차단 | 알림 IDOR 방어 확인 | IDOR / BOLA | 타인 알림 id는 404 | `notifications.service.spec.ts`, `notifications.controller.spec.ts` 일부 있음 | `backend/test/e2e/notifications-security.e2e-spec.ts` |
| 상품 설명 XSS 렌더링 | 저장된 사용자 입력이 HTML로 실행되지 않는지 확인 | Stored XSS | payload가 텍스트로 표시되고 alert 미발생 | `chats.service.spec.ts` 일부 정적 근거 있음 | `frontend/e2e/xss-rendering.spec.ts` 또는 Playwright 설정 |
| 채팅 메시지 XSS 렌더링 | 실시간/REST 메시지 렌더링 escape 확인 | Stored XSS | payload가 텍스트로 표시되고 alert 미발생 | 브라우저 e2e 미작성 | `frontend/e2e/chat-xss.spec.ts` |
| 상품 검색 SQLi payload | 검색어가 SQL 구조를 변경하지 않는지 확인 | SQL Injection | 정상 검색 처리, 내부 오류/전체 노출 없음 | service spec과 `$queryRawUnsafe` 미호출 검증 있음 | `backend/test/e2e/products-search-security.e2e-spec.ts` |
| 관리자 검색 SQLi payload | 관리자 검색도 ORM 조건을 사용하는지 확인 | SQL Injection, 관리자 권한 우회 | ADMIN만 접근 가능하고 payload는 검색어로 처리 | admin service spec 일부 있음 | `backend/test/e2e/admin-search-security.e2e-spec.ts` |
| 정상 상품 이미지 업로드 | 허용 파일 성공 경로 확인 | 파일 업로드 취약점 | jpg/png/webp 업로드 성공 | service unit test 있음 | `backend/test/e2e/product-upload-security.e2e-spec.ts` |
| 위장 파일 업로드 거부 | double extension, SVG, HTML, MIME mismatch 거부 확인 | 파일 업로드 취약점 | 400 응답, 파일/DB record 미생성 | service unit test 있음 | `backend/test/e2e/product-upload-security.e2e-spec.ts` |
| 결제 생성 amount 주입 거부 | 결제 금액을 body에서 받지 않는지 확인 | 결제 금액 조작, Mass Assignment | 초과 필드 400 또는 서버 금액 유지 | payments DTO/service spec 있음 | `backend/test/e2e/payments-security.e2e-spec.ts` |
| 결제 승인 amount mismatch 거부 | Toss 승인 단계 금액 대조 확인 | 결제 금액 조작 | Toss provider 호출 전 400 | `payments.service.spec.ts` 있음 | `backend/test/e2e/payments-security.e2e-spec.ts` |
| 일반 사용자 관리자 API 접근 차단 | 서버 권한 검증 확인 | 관리자 권한 우회 | USER는 403 | admin controller/guard spec 있음 | `backend/test/e2e/admin-authz.e2e-spec.ts` |
| 정지 관리자 접근 차단 | DB status 재확인 확인 | 관리자 권한 우회 | SUSPENDED ADMIN은 401 또는 403 | `jwt-auth.guard.spec.ts`, `roles.guard.spec.ts` 있음 | `backend/test/e2e/admin-authz.e2e-spec.ts` |
| role/status 필드 주입 거부 | DTO whitelist 동작 확인 | Mass Assignment | 초과 필드 400 | DTO spec 다수 있음 | `backend/test/e2e/mass-assignment.e2e-spec.ts` |
| 공개 응답 민감필드 부재 | passwordHash/email/phone 노출 방지 확인 | 민감정보 노출 | 응답 JSON에 민감 필드 없음 | service spec 다수 있음 | `backend/test/e2e/sensitive-response.e2e-spec.ts` |
| invalid webhook signature 거부 | 위조 webhook 차단 확인 | Webhook Forgery | 401, 결제 상태 변경 없음 | `toss-webhook-verifier.spec.ts`, `payments.service.spec.ts` 있음 | `backend/test/e2e/payment-webhook-security.e2e-spec.ts` |
| webhook amount mismatch 거부 | 서명 후 payload 대조 확인 | Webhook Forgery, 결제 금액 조작 | 400, 결제 상태 변경 없음 | service unit test 보강 필요 | `backend/test/e2e/payment-webhook-security.e2e-spec.ts` |
| 동일 상품 동시 예약 | 중복 판매 방어 확인 | Race Condition / 중복 판매 | 1건 성공, 나머지 409 | unit 근거 일부 있음 | `backend/test/integration/transaction-race.spec.ts` |
| 동일 거래 중복 결제 요청 | idempotency와 unique 제약 확인 | Race Condition / 중복 판매, 결제 금액 조작 | 같은 idempotency는 재사용, 다른 키는 409 | `payments.service.spec.ts` 있음 | `backend/test/integration/payment-idempotency.spec.ts` |
| 반복 로그인 실패 잠금 | 무차별 대입 완화 확인 | Rate Limit 부재 | 실패 횟수 초과 후 로그인 거부 | `auth.service.spec.ts` 있음 | e2e 보강: `backend/test/e2e/auth-rate-security.e2e-spec.ts` |
| API 반복 요청 429 | Nest Throttler 실제 적용 확인 | Rate Limit 부재 | 제한 초과 시 429 | `ThrottlerGuard` 적용 확인 안 됨 | guard 적용 후 `backend/test/e2e/rate-limit.e2e-spec.ts` |
| CSRF cross-origin 요청 | CSRF 완화/한계 확인 | CSRF | Authorization 없는 상태 변경 요청 거부 | CSRF token/guard 테스트 미작성 | `backend/test/e2e/csrf-security.e2e-spec.ts` |

## 2. 수동 검증 시나리오

| 시나리오 | 절차 | 기대 결과 | 보고서 캡처 포인트 |
|---|---|---|---|
| IDOR 채팅 접근 | 사용자 A/B를 생성하고 B의 채팅 ID를 A 토큰으로 조회 | 403 또는 404 | 요청 URL, Authorization 사용자, 응답 status/body |
| IDOR 거래 접근 | B의 거래 상세 UUID를 A 토큰으로 요청 | 404 | 요청/응답, DB의 거래 buyer/seller |
| 결제 영수증 접근 제한 | 제3자 토큰으로 payment receipt 조회 | 403 | 결제 ID, 응답 status |
| 관리자 API 권한 | USER 토큰, SUSPENDED ADMIN 토큰, ACTIVE ADMIN 토큰 순서로 `/api/admin/users` 요청 | USER/SUSPENDED ADMIN 차단, ACTIVE ADMIN 성공 | 세 요청 결과 비교 |
| XSS 상품 설명 | XSS 검증 문자열을 상품 설명에 저장하고 상세 화면 조회 | 텍스트로 표시, 스크립트 미실행 | 브라우저 화면과 console/alert 미발생 |
| XSS 채팅 메시지 | 검증 문자열을 채팅으로 전송하고 상대방 화면 조회 | 텍스트로 표시, 스크립트 미실행 | 채팅 화면 |
| SQLi 검색 | SQLi 형태 검색어로 상품 검색 요청 | 내부 오류/전체 노출 없음 | 요청 query와 응답 결과 |
| 위장 파일 업로드 | `shell.php.jpg`, SVG, MIME mismatch 파일을 상품 이미지 업로드 endpoint로 전송 | 400, DB/파일 저장 없음 | multipart 요청, 응답, 파일 저장 경로 확인 |
| 결제 amount 변조 | 결제 생성 body에 `amount`, `price`, `status`, `userId` 추가 | 400 또는 서버 가격 유지 | 요청 body, 응답, DB Payment/Transaction amount |
| Toss 승인 amount mismatch | 승인 body의 amount를 payment.amount와 다르게 전송 | 400, provider confirm 호출 전 차단 | 요청/응답, provider 호출 로그 또는 mock assertion |
| invalid webhook | 잘못된 signature로 webhook 요청 | 401, 결제 상태 변경 없음 | raw body, headers, 응답 status, DB 상태 |
| webhook amount mismatch | 유효 signature지만 amount가 DB와 다른 webhook 요청 | 400, 결제 상태 변경 없음 | 요청/응답, DB Payment amount |
| 동시 예약 | 두 구매자 또는 두 요청으로 동일 상품 예약을 동시에 시도 | 1건 성공, 나머지 409 | 병렬 요청 로그, Product.status, Transaction.status |
| 로그인 실패 잠금 | 같은 이메일로 잘못된 비밀번호를 반복 입력 | 실패 횟수 초과 후 잠금 | 응답 status, User.loginFails/lockedUntil |
| CSRF 한계 확인 | Authorization header 없이 외부 origin 형태로 상태 변경 API 요청 | 일반 API는 401, cookie-only endpoint는 정책 재검토 | Origin, Cookie, Authorization 유무, 응답 status |

## 3. 보고서에 넣을 전후 비교 캡처 후보

| 취약점 | 패치 전 캡처 | 패치 후 캡처 | 대체 가능한 코드 근거 |
|---|---|---|---|
| IDOR / BOLA | 객체 ID만으로 타인 채팅/거래가 조회되는 취약 패턴 예시 | 비참여자 요청이 403/404로 차단되는 curl/Postman 결과 | `assertParticipant`, `assertProductSeller`, `assertBuyer`, `markAsRead(userId, id)` |
| Stored XSS | 사용자 입력을 HTML로 직접 렌더링하는 취약 패턴 예시 | payload가 텍스트로 표시되고 alert가 발생하지 않는 화면 | React `<p>{value}</p>` 렌더링, `dangerouslySetInnerHTML` 미사용 검색 |
| SQL Injection | `$queryRawUnsafe` 문자열 보간 취약 패턴 예시 | SQLi payload 검색 요청이 정상 처리되는 결과 | Prisma `findMany`/`where.contains`, `$queryRawUnsafe` production 미사용 |
| 파일 업로드 취약점 | 원본 파일명/MIME만 신뢰하는 취약 패턴 예시 | double extension/MIME mismatch 업로드 400 응답 | `validateImage`, `detectImageType`, UUID 파일명 생성 |
| 결제 금액 조작 | body amount를 결제 금액으로 사용하는 취약 패턴 예시 | amount 주입/불일치 승인 요청 400 응답 | `CreatePaymentDto`, `assertServerAmountConsistent`, `assertApprovalRequestMatches` |
| 관리자 권한 우회 | 일반 사용자가 관리자 API를 직접 호출하는 취약 패턴 예시 | USER 403, SUSPENDED ADMIN 401/403, ACTIVE ADMIN 200 비교 | admin controller `@UseGuards`, `@Roles`, DB role/status 재조회 |
| CSRF | cookie-only 상태 변경 취약 패턴 예시 | Authorization 없는 일반 API 401, SameSite cookie 설정 근거 | `auth.controller.ts` cookie option, `api/client.ts` Bearer access token |
| Race Condition / 중복 판매 | 동시에 두 예약이 성공하는 취약 패턴 예시 | 병렬 요청 중 1건 성공, 나머지 409 | `$transaction`, 조건부 `updateMany`, Payment unique 제약 |
| Mass Assignment | `role=ADMIN` 또는 `sellerId` 주입이 반영되는 취약 패턴 예시 | 초과 필드 400 응답 | 전역 `ValidationPipe`, DTO injection spec |
| Rate Limit 부재 | 반복 요청이 무제한 처리되는 취약 패턴 예시 | 로그인 실패 잠금 캡처, 429는 보강 후 캡처 | Redis login failure lock, `ThrottlerModule` 설정 |
| 민감정보 노출 | 사용자 relation 전체 응답에 `passwordHash`가 포함되는 취약 패턴 예시 | API 응답에 민감 필드 없음 | Prisma `PUBLIC_USER_SELECT`, service spec |
| Webhook Forgery | signature 없는 `DONE` webhook이 반영되는 취약 패턴 예시 | invalid signature 401, amount mismatch 400 | `TossWebhookVerifier`, `handleWebhook` DB amount 대조 |
