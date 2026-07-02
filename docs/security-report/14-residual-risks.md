# 잔존 위험

## 1. 범위

이 문서는 현재 코드와 테스트로 확인한 보안 상태를 “구현 및 검증 완료”, “부분 검증”, “외부 환경 의존”, “운영 배포 전 필요 작업”, “실제 서비스 확장 시 추가 통제”로 나눠 정리한다. 완전한 안전을 보장한다는 의미가 아니라, 현재 저장소 근거로 말할 수 있는 범위와 아직 말할 수 없는 범위를 분리하는 목적이다.

## 2. 구현 및 검증 완료

| 영역 | 현재 상태 | 근거 |
|---|---|---|
| 인증 사용자 DB status 재조회 | 기존 인증이 남아 있어도 비활성 사용자는 HTTP/WS 접근이 차단된다. | `2df58b9`, `jwt-auth.guard.ts`, `roles.guard.ts`, `chats.gateway.ts`, 관련 spec |
| IDOR/BOLA 서비스 검증 | 상품 작성자, 채팅 참여자, 거래 당사자, 결제 당사자, 알림 소유자 기준 접근 검증이 구현되어 있다. | `products.service.ts`, `chats.service.ts`, `transactions.service.ts`, `payments.service.ts`, `notifications.service.ts`, `security-smoke.spec.ts` |
| 파일 업로드 검증 | 확장자, MIME, magic byte, 위험 segment, UUID 파일명, 상품 작성자 권한을 검증한다. | `products-upload.multipart.spec.ts` 9 tests |
| 거래 금액 서버 기준 계산 | 거래 생성과 결제 생성에서 클라이언트 금액을 신뢰하지 않고 DB 상품/거래 금액을 사용한다. | `transactions.service.ts`, `payments.service.ts`, `security-smoke.spec.ts` |
| 관리자 권한과 AdminLog | ADMIN role guard, USER 차단, 정상 경로의 관리자 조치 로그 생성, 관리자 DTO 주입 거부가 검증됐다. | `admin-security.spec.ts`, `admin.service.spec.ts`, `roles.guard.spec.ts` |
| 결제 전 거래 완료 차단 | `RESERVED` 거래는 완료할 수 없고, 완료 전 persisted `PAID` payment를 확인한다. | `transactions.service.ts`, `transactions.service.spec.ts` |
| 거래 예약 동시성 | 같은 상품의 동시 예약에서 1건만 성공하고 나머지는 충돌로 수렴한다. | `transactions-race.spec.ts` |
| Webhook 서명 검증 | raw body와 timestamp 기반 HMAC 검증 및 timing-safe 비교가 구현되어 있다. | `toss-webhook-verifier.ts`, `toss-webhook-verifier.spec.ts` |
| Stored XSS 주요 sink 점검 | production 코드에서 `dangerouslySetInnerHTML`/`innerHTML` 사용이 발견되지 않았고, 채팅 payload는 문자열로 처리된다. | grep 결과, `chats-ws-security.spec.ts`, `chats.service.spec.ts` |
| SQL Injection 주요 sink 점검 | production 코드에서 Prisma raw query sink가 발견되지 않았다. | grep 결과, Prisma ORM 기반 service 구현 |
| 민감정보 응답 제한 | 공개 select와 response DTO에서 password hash, 결제 secret, 내부 session 값을 응답하지 않는 패턴이 확인된다. | users/products/admin/payments/notifications service, 관련 spec |

## 3. 부분 검증

| 영역 | 부분 검증 사유 | 운영 전 보강 |
|---|---|---|
| Route별 rate limit | `ThrottlerModule` 설정은 있으나 현재 검색 결과 전역 `ThrottlerGuard` 또는 route별 `@Throttle` 적용은 확인되지 않았다. 로그인 실패 잠금은 별도로 구현되어 있다. | 전역 또는 민감 route별 guard 적용 후 429 테스트 추가 |
| CSRF 방어 | 상태 변경 API는 Bearer 인증을 요구하고 refresh cookie는 보수적 속성을 사용한다. 다만 cookie만 보낸 상태 변경 요청 e2e는 별도 증거가 부족하다. | cookie-only 상태 변경 요청 401/403 e2e 추가 |
| WebSocket 브라우저 e2e | Gateway 단위 테스트와 service 테스트는 충분하지만 실제 브라우저 Socket.IO room 수신 범위 증거는 부족하다. | socket.io-client 또는 Playwright 기반 room 수신 테스트 |
| 관리자 HTTP e2e | guard metadata와 service action 테스트는 있으나 실제 HTTP `/api/admin/*` 호출 e2e 증거는 제한적이다. | USER 403, ADMIN 성공, AdminLog DB assertion e2e |
| 신고 처리 후 알림 | 신고/관리자 처리와 notification service는 구현되어 있지만, 모든 신고 처리 이벤트의 알림 생성 정책은 별도 검증이 필요하다. | 정책 확정 후 notification 생성/수신 테스트 |
| 결제 동시성 | 결제 idempotency와 금액 검증은 구현되어 있으나 외부 provider 왕복과 동시 승인/환불 경합은 단위 테스트 중심이다. | sandbox와 DB transaction 기반 통합 테스트 |
| 거래 완료/정산 상태 모델 | 결제 전 완료는 차단했지만 판매자 완료 API와 구매자 구매확정 API가 모두 `COMPLETED` 전이에 관여한다. | 완료, 배송, 에스크로 release 책임을 단일 상태 머신으로 정리 |
| 상품 이미지 생명주기 | 업로드 검증은 완료됐지만 상품 숨김/삭제 후 이미지 파일과 `ProductImage` metadata가 즉시 제거되지는 않는다. | 파일 삭제 정책, visibility 검사, 비동기 정리 job 추가 |
| AdminLog 원자성 | 정상 경로 로그 생성은 테스트됐지만 일부 경로는 상태 update와 log insert가 같은 DB transaction으로 묶이지 않는다. | 상태 변경과 AdminLog insert를 동일 transaction으로 묶고 로그 실패 시 rollback |
| 브라우저 보안 렌더링 | 정적 sink 검색과 backend XSS 테스트는 통과했지만, 실제 화면 캡처 기반 스크립트 미실행 증거는 제한적이다. | 상품/채팅/후기 XSS payload Playwright 테스트 |

## 4. 외부 환경 의존

| 의존 요소 | 위험 | 관리 방안 |
|---|---|---|
| DB/Redis 기동 상태 | DB 또는 Redis 미기동 시 인증, 세션, 거래, 결제 흐름이 실패한다. 브라우저에서는 5xx처럼 보일 수 있다. | health check, readiness probe, 장애 로그 연결 |
| Toss sandbox/운영 API | 외부 결제 승인, 취소, webhook endpoint는 네트워크와 provider 설정에 의존한다. | sandbox 계정으로 승인/취소/웹훅 수동 및 자동 검증 |
| 배포 build 산출물 | stale `dist`가 실행되면 브라우저 QA가 최신 코드와 다른 결과를 볼 수 있다. | `clean`/`prebuild` 유지, 배포 직후 commit hash/health endpoint 확인 |
| 파일 저장소 | local upload directory 권한, 정적 제공 정책, 백업 정책에 따라 이미지 접근성과 삭제 정책이 달라진다. | 웹 루트 분리, MIME 고정, visibility-aware 제공, object storage 전환 시 private bucket 정책 |
| Reverse proxy/CORS | 프록시 body size, timeout, CORS origin 설정에 따라 업로드/인증 동작이 달라질 수 있다. | 운영 origin allowlist, request size, timeout, TLS 설정 점검 |
| 로그/모니터링 | 보안 이벤트가 로그에 남지 않으면 침해 징후를 놓칠 수 있다. | 인증 실패, 관리자 조치, 결제 실패, webhook 실패 audit log와 alert 구성 |

## 5. 운영 배포 전에 필요한 작업

운영 배포 전에는 다음 작업이 필요하다.

| 작업 | 이유 |
|---|---|
| 실제 운영 환경변수 검증 | `.env.example`은 placeholder이며, 실제 secret과 callback URL은 환경별로 분리해야 한다. |
| route별 rate limit 적용 확인 | 로그인 잠금만으로는 전체 API 남용을 막기 어렵다. 결제, 업로드, 신고, 채팅에 별도 제한이 필요하다. |
| CSRF 회귀 테스트 추가 | refresh cookie와 인증 헤더 조합이 설계대로 동작하는지 브라우저 조건에서 확인해야 한다. |
| 관리자 HTTP e2e와 UI 캡처 | guard metadata 테스트만으로는 배포 라우팅, CORS, frontend route guard까지 모두 증명하지 못한다. |
| Toss sandbox end-to-end | provider approve/cancel/webhook을 실제 sandbox로 확인해야 운영 결제 설정 오류를 줄일 수 있다. |
| 파일 업로드 저장소 권한 점검 | 업로드 파일이 실행 권한을 갖거나 서버 템플릿으로 해석되지 않도록 배포 서버 설정을 확인해야 한다. |
| 숨김/삭제 상품 이미지 정리 정책 | 기존 이미지 URL을 아는 사용자가 계속 조회하지 않도록 파일 삭제, 보존 기간, visibility 검사 중 하나를 선택해야 한다. |
| AdminLog transaction 정책 | 관리자 조치와 로그 insert를 같은 transaction으로 묶고 실패 시 rollback할지 운영 정책을 확정해야 한다. |
| 5xx 재현/분석 절차 | 거래 예약이나 관리자 처리에서 5xx가 보이면 서버 로그, DB/Redis 상태, 배포 commit을 함께 기록해야 한다. |
| 보안 헤더 운영 확인 | Helmet 설정이 proxy/CDN 뒤에서도 유지되는지 실제 response header로 확인해야 한다. |
| seed/demo 계정 제거 또는 격리 | 개발용 데이터와 안내 문구가 운영에 노출되지 않도록 배포 profile을 분리해야 한다. |

## 6. 실제 서비스 확장 시 추가할 보안 통제

서비스가 실제 사용자와 결제 데이터를 다루는 규모로 커지면 다음 통제를 추가해야 한다.

| 통제 | 목적 |
|---|---|
| Object storage virus scan | 업로드 이미지의 악성 payload, polyglot 파일, archive bomb 위험 완화 |
| 이미지 재인코딩 파이프라인 | 원본 파일 metadata와 불필요한 chunk 제거, 안전한 MIME으로 재저장 |
| Web Application Firewall | 반복 공격, 알려진 exploit payload, 대량 스캔 완화 |
| 감사 로그 무결성 강화 | AdminLog/AuditLog에 append-only 저장, 해시 체인 또는 외부 로그 저장소 적용 |
| 이상 거래 탐지 | 반복 결제 실패, 동일 사용자 다중 계정, 신고 누적, 비정상 가격 패턴 탐지 |
| 개인정보 최소화/마스킹 | 관리자 목록과 로그에서 이메일/전화번호 등 개인정보 노출을 업무상 필요한 수준으로 제한 |
| Secret rotation | 결제 secret, JWT secret, webhook secret의 주기적 교체와 유출 대응 절차 |
| DB row-level 정책 검토 | application bug가 생겨도 DB 계층에서 tenant/user isolation을 보조 |
| 종단간 e2e 회귀 | 상품 등록부터 결제, 거래 완료, 후기, 신고, 관리자 처리까지 브라우저 자동화 |
| 보안 이벤트 알림 | 관리자 권한 실패, webhook 위조, 업로드 거부 급증, 로그인 실패 급증에 대한 alert |

## 7. 사실로 확정하지 않은 위험

다음 항목은 요청 범위에 있었지만 저장소 근거로 직접 확정하지 않았다.

| 항목 | 확인 결과 | 보고서 처리 |
|---|---|---|
| 거래 예약 및 관리자 처리 503 | 현재 문서, 커밋, 코드 grep에서 직접 재현 기록을 찾지 못했다. | 보안 취약점이나 최종 실패 상태로 쓰지 않고 운영/환경 잔존 위험으로만 기록 |
| 운영 Toss 결제 성공 | sandbox 또는 운영 provider 실제 왕복 결과는 현재 저장소 증거에 없다. | 외부 환경 의존 항목으로 기록 |
| 관리자 UI 스크린샷 기반 검증 | Admin service/guard 테스트는 있으나 화면 캡처 증거는 없다. | 부분 검증으로 기록 |
| route별 429 동작 | rate limit 설정은 있으나 guard 적용 증거와 429 테스트가 부족하다. | 부분 검증 및 운영 전 필요 작업으로 기록 |

## 8. 최종 판단

현재 코드 기준으로 핵심 보안 패치와 방어 검증은 자동 테스트와 정적 검색으로 상당 부분 확인됐다. 특히 BOLA, 파일 업로드, 거래 금액 서버 기준 계산, 관리자 권한, 동시 예약, webhook 서명 검증은 보고서 증거로 연결할 수 있다.

남은 위험은 주로 운영 환경과 브라우저 e2e 증거 영역에 있다. rate limit 적용, CSRF 회귀 테스트, 실제 Socket.IO/관리자/결제 sandbox e2e, 5xx 재현 절차는 운영 배포 전 별도 체크리스트로 다루는 것이 맞다.
