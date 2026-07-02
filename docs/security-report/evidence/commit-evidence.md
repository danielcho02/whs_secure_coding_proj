# 커밋 증거

## `ed10555` / 2026-06-27 18:13:51 +0900

- 메시지: `chore(infra): bootstrap secure project skeleton (NFR-03,NFR-10,SR-15,SR-34,SR-38)`
- 주요 변경 파일: `backend/src/main.ts`, `backend/src/app.module.ts`, `backend/src/common/*`, `backend/src/config/*`, `docs/*`, `frontend/src/api/client.ts`
- 해결한 문제: 보안 중심 프로젝트 골격, 전역 ValidationPipe, Helmet/CORS, 환경 검증 기반 마련
- 연결된 보안 테스트: 초기 app/config 테스트
- 보고서 활용 위치: `00-project-overview.md`, `08-mass-assignment.md`, `10-csrf-and-session-security.md`

## `0296390` / 2026-06-27 21:30:10 +0900

- 메시지: `feat(auth): implement secure jwt refresh session flow (...)`
- 주요 변경 파일: `backend/src/modules/auth/*`, `backend/src/common/guards/jwt-auth.guard.ts`, `backend/src/modules/users/*`
- 해결한 문제: bcrypt 저장, 로그인 실패 잠금, refresh session 회전, 안전한 인증 응답
- 연결된 보안 테스트: `auth.service.spec.ts`, `auth.controller.spec.ts`, `jwt-auth.guard.spec.ts`
- 보고서 활용 위치: `10-csrf-and-session-security.md`, `11-rate-limit-and-sensitive-data.md`

## `f29b135` / 2026-06-28 09:57:39 +0900

- 메시지: `feat(products): implement secure product crud and uploads (...)`
- 주요 변경 파일: `backend/src/modules/products/*`, `frontend/src/api/products.ts`
- 해결한 문제: 상품 작성자 검증, 검색 ORM 조건, 응답 필드 제한, 이미지 확장자/MIME/시그니처 검증
- 연결된 보안 테스트: `products.service.spec.ts`, `products.controller.spec.ts`, `product.dto.spec.ts`
- 보고서 활용 위치: `02-idor-bola.md`, `03-stored-xss.md`, `04-sql-injection.md`, `05-file-upload.md`, `08-mass-assignment.md`

## `21b20b9` / 2026-06-28 10:22:39 +0900

- 메시지: `feat(chats): implement secure participant messaging (...)`
- 주요 변경 파일: `backend/src/modules/chats/*`, `frontend/src/api/chats.ts`
- 해결한 문제: 채팅방/메시지 참여자 검증, WS 경로, 메시지 문자열 처리
- 연결된 보안 테스트: `chats.service.spec.ts`, `chats.gateway.spec.ts`, `chats.dto.spec.ts`
- 보고서 활용 위치: `02-idor-bola.md`, `03-stored-xss.md`, `08-mass-assignment.md`

## `318c7ca` / 2026-06-28 11:27:40 +0900

- 메시지: `feat(transactions): implement secure transaction flow and dev seed (...)`
- 주요 변경 파일: `backend/src/modules/transactions/*`, `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260628020031_add_review_author_unique/migration.sql`
- 해결한 문제: 거래 상태 머신, 서버 기준 amount, 거래 당사자 검증, 후기 중복 제약
- 연결된 보안 테스트: `transactions.service.spec.ts`, `transactions.controller.spec.ts`, `transactions.dto.spec.ts`
- 보고서 활용 위치: `02-idor-bola.md`, `06-price-tampering.md`, `09-race-condition.md`

## `83b1967` / 2026-06-28 13:01:32 +0900

- 메시지: `feat(payments): implement secure escrow payment flow with toss sandbox adapter (...)`
- 주요 변경 파일: `backend/src/modules/payments/*`, `backend/prisma/migrations/20260628050000_add_payments_toss_fields/migration.sql`, `frontend/src/api/payments.ts`
- 해결한 문제: 서버 기준 결제 금액, idempotency, Toss approve 대조, webhook HMAC, escrow/refund/receipt
- 연결된 보안 테스트: `payments.service.spec.ts`, `payments.controller.spec.ts`, `toss-webhook-verifier.spec.ts`
- 보고서 활용 위치: `06-price-tampering.md`, `12-webhook-forgery.md`, `14-residual-risks.md`

## `4fa47c2` / 2026-06-28 13:32:50 +0900

- 메시지: `feat(moderation): implement reports blocks and admin moderation (...)`
- 주요 변경 파일: `backend/src/modules/reports/*`, `backend/src/modules/blocks/*`, `backend/src/modules/admin/*`, `backend/prisma/schema.prisma`
- 해결한 문제: 신고/차단/관리자 API, AdminLog, 관리자 restore 안전 검증
- 연결된 보안 테스트: `reports.service.spec.ts`, `blocks.service.spec.ts`, `admin.service.spec.ts`, `admin.controllers.spec.ts`
- 보고서 활용 위치: `07-admin-authorization.md`, `08-mass-assignment.md`, `11-rate-limit-and-sensitive-data.md`

## `2df58b9` / 2026-06-28 15:18:18 +0900

- 메시지: `fix(auth): enforce active user status for http and websocket sessions (SR-10,SR-35,SR-36)`
- 주요 변경 파일: `jwt-auth.guard.ts`, `roles.guard.ts`, `chats.gateway.ts`, `reports.service.ts`, 관련 테스트와 문서
- 해결한 문제: 정지 사용자가 기존 인증으로 HTTP/WS 또는 관리자 API를 계속 사용할 수 있는 위험
- 연결된 보안 테스트: `jwt-auth.guard.spec.ts`, `roles.guard.spec.ts`, `chats.gateway.spec.ts`, `reports.service.spec.ts`
- 보고서 활용 위치: `07-admin-authorization.md`, `10-csrf-and-session-security.md`

## `8a1982f` / 2026-06-28 16:04:09 +0900

- 메시지: `feat: implement notifications api and chat reports`
- 주요 변경 파일: `backend/src/modules/notifications/*`, `backend/src/modules/reports/*`, `backend/src/modules/chats/chats.service.ts`
- 해결한 문제: 본인 알림 조회/읽음, CHAT 신고 참여자 검증, 알림 target
- 연결된 보안 테스트: notifications/reports 관련 spec
- 보고서 활용 위치: `02-idor-bola.md`, `11-rate-limit-and-sensitive-data.md`

## `291211a` / 2026-06-29 11:49:32 +0900

- 메시지: `test: add gap API security coverage`
- 주요 변경 파일: products/users/transactions service/controller spec
- 해결한 문제: 거래 상세, 내 상품, 찜 목록의 currentUser 기준 검증 테스트 보강
- 연결된 보안 테스트: products/users/transactions gap tests
- 보고서 활용 위치: `02-idor-bola.md`, `11-rate-limit-and-sensitive-data.md`

## `692c91b` / 2026-06-29 11:51:52 +0900

- 메시지: `fix: add authenticated marketplace gap APIs`
- 주요 변경 파일: `products.controller.ts`, `products.service.ts`, `transactions.controller.ts`, `transactions.service.ts`, `users.controller.ts`, `users.service.ts`
- 해결한 문제: 거래 상세, 내 상품, 내 찜 API를 실제 인증 사용자 기준으로 구현
- 연결된 보안 테스트: `transactions.controller.spec.ts`, `users.service.spec.ts`, `products.service.spec.ts`
- 보고서 활용 위치: `02-idor-bola.md`

## `5e38d6d` / 2026-06-29 13:18:52 +0900

- 메시지: `fix(frontend): polish browser QA visual issues`
- 주요 변경 파일: `frontend/src/pages/AdminPages.tsx`, `frontend/src/ui/ImageFallback.tsx`, `frontend/src/pages/LoginPage.tsx`, `backend/src/modules/admin/admin.service.ts`
- 해결한 문제: broken image fallback, 관리자 상품 썸네일, 로그인 오류 문구, UI 간격
- 연결된 보안 테스트: 직접 보안 테스트보다 브라우저 QA 재검증 근거
- 보고서 활용 위치: `13-testing-and-qa.md`, `evidence/browser-qa-summary.md`

## `6ee3585` / 2026-06-29 17:15:52 +0900

- 메시지: `fix(frontend): resolve final browser QA issues`
- 주요 변경 파일: `ChatsPage.tsx`, `NotificationsPage.tsx`, `ProductFormPage.tsx`, `TransactionsPage.tsx`, `frontend/src/ui/imageUrl.ts`
- 해결한 문제: 채팅 중복 표시, 환불 종료 거래 UI, 가격 validation, 알림 이동, placeholder 이미지 처리
- 연결된 보안 테스트: frontend lint/build/security grep 기록
- 보고서 활용 위치: `13-testing-and-qa.md`

## `e180546` / 2026-07-02 13:37:54 +0900

- 메시지: `feat(security): complete secure MVP QA fixes`
- 주요 변경 파일: `security-smoke.spec.ts`, `products-upload.multipart.spec.ts`, `transactions-race.spec.ts`, `chats-ws-security.spec.ts`, `admin-security.spec.ts`, `docs/report-prep/*`, frontend QA files
- 해결한 문제: 보안 증거 테스트 추가, 업로드/동시성/WS/admin 방어 검증, 준비 중 UI 제거, 업로드 실패 recovery
- 연결된 보안 테스트: 핵심 보안 증거 테스트 5종
- 보고서 활용 위치: 거의 모든 취약점 문서와 `13-testing-and-qa.md`

## `981dfc3` / 2026-07-02 14:31:47 +0900

- 메시지: `fix: address payment and transaction review issues`
- 주요 변경 파일: `backend/src/config/configuration.ts`, `backend/.env.example`, `frontend/src/pages/TransactionsPage.tsx`, `ProductDetailPage.tsx`, `MePage.tsx`
- 해결한 문제: 결제 provider 기본값, 거래 상세 역할/결제 action 판정, 신뢰도 문구
- 연결된 보안 테스트: configuration spec, 현재 backend/frontend lint/build/test 재검증
- 보고서 활용 위치: `06-price-tampering.md`, `13-testing-and-qa.md`, `14-residual-risks.md`

## 현재 작업 트리 / 미커밋

- 메시지: 커밋 없음. 사용자 지시에 따라 커밋하지 않음.
- 주요 변경 파일: `transactions.service.ts`, `transactions.service.spec.ts`, `TransactionsPage.tsx`, 보안 보고서와 report-prep 문서
- 해결한 문제: 결제 전 `RESERVED` 거래 완료 차단, 완료 전 persisted `PAID` payment 검증, 이미지 잔존 위험 문서화, AdminLog 원자성 단정 제거, 정적 grep 증거 정정
- 연결된 보안 테스트: `transactions.service.spec.ts`의 RESERVED 완료 거부, PAID payment 없는 완료 거부, 정상 PAID 완료, 권한 없는 완료 거부
- 보고서 활용 위치: `06-price-tampering.md`, `05-file-upload.md`, `07-admin-authorization.md`, `13-testing-and-qa.md`, `14-residual-risks.md`
