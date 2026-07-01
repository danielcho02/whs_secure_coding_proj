# 시큐어 코딩 프로젝트 보고서 목차 초안

1. 프로젝트 개요

   보안 중심 중고거래 웹 서비스의 목적과 개발 범위를 설명한다.
   단순 기능 구현이 아니라 OWASP 기반 취약점 분석, 패치, 전후 비교를 함께 수행하는 프로젝트임을 밝힌다.
   백엔드 NestJS/Prisma/PostgreSQL/Redis, 프론트 React/Vite, Socket.IO, JWT access/refresh 구조를 요약한다.
   본 보고서의 근거 범위는 실제 구현 코드, 단위 테스트, 1차/2차 보고서 준비 문서임을 명시한다.

2. 서비스 주요 기능

   회원가입, 로그인, 프로필, 상품 등록/검색/상세/수정/삭제, 찜 기능을 설명한다.
   채팅, 거래 요청/예약/취소/완료, 안전결제, 구매확정, 환불, 영수증 조회 흐름을 정리한다.
   신고, 차단, 관리자 신고 처리, 상품 숨김/복구, 사용자 제재, 관리자 로그를 운영 기능으로 설명한다.
   알림은 내 알림 조회/읽음과 채팅 알림 생성까지 실제 구현된 범위로 제한하고, 전체 이벤트 알림은 한계로 분리한다.

3. 시스템 아키텍처

   React SPA가 NestJS API와 통신하고, 서버가 Prisma를 통해 PostgreSQL에 접근하는 구조를 설명한다.
   Redis는 refresh session/jti와 로그인 실패 카운터에 사용되며, Socket.IO는 채팅 실시간 이벤트에 사용된다.
   요청 파이프라인은 Helmet, CORS, ValidationPipe, JwtAuthGuard, RolesGuard, service-level authorization 순서로 정리한다.
   보안 판단은 클라이언트 입력이 아니라 토큰 subject와 DB 상태를 기준으로 수행한다는 원칙을 강조한다.

4. 기능 요구사항

   `docs/requirements.md`의 FR-01~FR-50을 도메인별로 요약한다.
   인증/회원, 상품, 채팅, 거래, 안전결제, 신고/관리자, 알림으로 나누어 구현 현황을 연결한다.
   주요 보안 보고서 근거는 상품, 채팅, 거래, 결제, 관리자 기능에서 나온다는 점을 표시한다.
   비밀번호 재설정, 카카오 로그인, 프로필 사진 저장, 채팅 이미지 업로드 등 미연결 기능은 완료 기능과 분리한다.

5. 보안 요구사항

   SR-01~SR-39를 인증/세션, 접근제어, 입력 검증, 파일 업로드, 결제, 개인정보, API 보안으로 묶어 설명한다.
   핵심 요구사항은 BOLA 방어, 서버 기준 결제 금액 산정, DTO whitelist, 파일 시그니처 검증, 관리자 권한 검증이다.
   민감정보 노출 방지는 `@Exclude()`가 아니라 실제 코드의 Prisma `select` 기반 응답 제한으로 기술한다.
   Rate Limit과 CSRF는 요구사항은 있으나 현재 구현 근거가 부족한 보완 필요 항목으로 명시한다.

6. 위협 모델링

   STRIDE 관점에서 Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation of Privilege를 서비스 기능과 연결한다.
   Spoofing은 JWT/refresh session, Tampering은 결제 금액 및 상태 전이, Information Disclosure는 BOLA와 민감정보 노출로 설명한다.
   DoS는 로그인 실패 잠금과 Rate Limit 보완 필요로 나누어 정리한다.
   신뢰 경계는 브라우저-API, API-DB/Redis, API-PG webhook으로 분리한다.

7. 취약점 분석

   주요 취약점 6종을 중심으로 분석한다: IDOR/BOLA, Stored XSS, SQL Injection, 파일 업로드, 결제 금액 조작, 관리자 권한 우회.
   각 취약점은 관련 기능, 관련 FR/SR, 취약 패턴, 현재 구현 상태를 함께 제시한다.
   IDOR/BOLA, SQL Injection, 결제 금액 조작, 관리자 권한 우회는 실제 코드 근거가 충분한 항목으로 둔다.
   Stored XSS와 파일 업로드는 현재 방어 근거와 함께 e2e 또는 기능 범위 부족을 별도로 표시한다.
   CSRF, Race Condition, Mass Assignment, Rate Limit, 민감정보 노출, Webhook Forgery는 보강 취약점으로 분석한다.

8. 취약점 재현

   재현은 실제 공격 안내가 아니라 보안 검증 시나리오 형식으로 작성한다.
   주요 6종은 URL ID 변경, XSS payload 저장/렌더링, SQLi 형태 검색어, 위장 파일 업로드, amount 변조, 일반 사용자 관리자 API 접근으로 구성한다.
   현재 branch에 의도적 취약 구현이 없으므로, "패치 전"은 취약 패턴 기준의 비교 시나리오로 명시한다.
   실제 캡처가 없는 항목은 `security-test-plan.md`의 수동 검증 시나리오를 기준으로 3차 작업에서 증거를 확보한다.

9. 보안 패치

   IDOR/BOLA는 service-level seller/buyer/participant/userId 검증을 패치 핵심으로 설명한다.
   SQL Injection은 Prisma 조건 객체 기반 검색과 `$queryRawUnsafe` production 미사용을 근거로 제시한다.
   파일 업로드는 상품 이미지의 확장자, MIME, 매직바이트, UUID 파일명 검증을 설명하고 채팅 이미지는 한계로 분리한다.
   결제 금액 조작은 amount body 미수신, Transaction/Product/Payment amount 대조, idempotency를 핵심 패치로 설명한다.
   관리자 권한 우회는 JwtAuthGuard DB 재조회, RolesGuard ACTIVE+ADMIN 검사, DTO role injection 거부를 설명한다.

10. 패치 전후 비교

   주요 6종 취약점별로 취약 패턴과 현재 패치 후 동작을 표로 비교한다.
   IDOR/BOLA는 타인 객체 조회 가능 패턴과 403/404 차단 결과를 비교한다.
   결제 금액 조작은 클라이언트 amount 신뢰 패턴과 서버 DB 가격 대조 방식을 비교한다.
   관리자 권한 우회는 UI/role body 신뢰 패턴과 서버 guard 기반 권한 검증을 비교한다.
   아직 실행 캡처가 없는 항목은 코드 근거로 대체 가능하되, 최종 보고서 전 3차 작업에서 요청/응답 캡처를 확보한다.

11. 테스트 결과

   현재 테스트는 `backend/src/**/*.spec.ts` 중심의 unit/controller/DTO 테스트임을 명시한다.
   DTO injection, service authorization, payment amount mismatch, webhook signature, sensitive field exclusion 등 기존 테스트 근거를 정리한다.
   `backend/test`, `backend/test/e2e`, 루트 `test` 디렉터리는 1차 진단 기준 확인되지 않았으므로 e2e 테스트 미작성으로 표시한다.
   최종 보고서에는 3차 작업에서 실행한 `npm run test`, lint/build, curl/Postman, 프론트 화면 캡처 결과를 추가한다.

12. 한계 및 개선 방향

   CSRF token/guard, RateLimit guard 적용, Race Condition 동시성 e2e, Stored XSS 브라우저 e2e는 보완 필요로 정리한다.
   채팅 이미지 업로드, 비밀번호 재설정, 카카오 로그인, 프로필 사진 업로드 저장, 전체 알림 생산자는 미구현 또는 미연결 기능으로 분리한다.
   Toss sandbox 실제 승인/취소와 외부 webhook endpoint 검증은 unit mock 근거와 구분해 추가 증거가 필요하다고 작성한다.
   보완 방향은 테스트 우선: e2e 보안 테스트, 수동 검증 캡처, 증거 매트릭스 업데이트 순서로 제안한다.

13. 결론

   현재 구현은 BOLA 방어, 결제 금액 무결성, 관리자 권한 검증, Mass Assignment 차단, 민감정보 응답 제한, Webhook 서명 검증에서 강한 보안 근거를 가진다.
   주요 취약점 6종 중 IDOR/BOLA, SQL Injection, 결제 금액 조작, 관리자 권한 우회는 보고서 핵심 사례로 사용하기 적합하다.
   Stored XSS와 파일 업로드는 현재 방어 근거가 있으나 e2e와 기능 범위 보강 후 최종 보고서에 넣는 것이 안전하다.
   최종 보고서 작성 전에는 2차 문서를 바탕으로 실제 실행 결과와 전후 비교 캡처를 확보해야 한다.
