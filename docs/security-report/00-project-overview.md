# 프로젝트 개요

## 1. 대상 프로젝트

`whs_secure_coding_proj`는 중고거래 서비스를 가정한 React/Vite 프론트엔드와 NestJS/Fastify/Prisma 백엔드 프로젝트다. 주요 기능은 회원/세션, 상품, 이미지 업로드, 채팅, 거래 예약, 안전결제, 신고, 관리자 조치, 알림이다.

조사 시점 기준:

- 현재 브랜치: `docs/security-patch-report`
- 현재 커밋: `4aed491`
- `main`: `4aed491`
- 코드 수정: 없음
- 문서 생성 위치: `docs/security-report/`

## 2. 조사한 기준 문서

다음 문서를 직접 확인했다.

- `security-spec.md`
- `requirements.md`
- `api-spec.md`
- `architecture.md`
- `database-design.md`
- `coding-conventions.md`
- `README.md`
- `docs/report-prep/full-service-implementation-plan.md`
- `docs/report-prep/security-evidence-matrix.md`
- `docs/report-prep/security-test-plan.md`

이 문서들은 보안 요구사항, API 신뢰 경계, DTO whitelist, 서비스 계층 권한 검사, 결제/웹훅 검증, 테스트 계획을 제공한다.

## 3. 조사한 실제 코드와 테스트

핵심 확인 파일은 다음과 같다.

- 공통: `backend/src/main.ts`, `backend/src/app.module.ts`
- 인증/세션: `backend/src/modules/auth/*`, `backend/src/common/guards/jwt-auth.guard.ts`, `backend/src/common/guards/roles.guard.ts`
- 상품/업로드: `backend/src/modules/products/*`
- 채팅/웹소켓: `backend/src/modules/chats/*`
- 거래/후기: `backend/src/modules/transactions/*`
- 결제/웹훅: `backend/src/modules/payments/*`
- 신고/알림/관리자: `backend/src/modules/reports/*`, `backend/src/modules/notifications/*`, `backend/src/modules/admin/*`
- DB 제약: `backend/prisma/schema.prisma`, `backend/prisma/migrations/*`
- 보안 테스트: `backend/src/security-smoke.spec.ts`, `products-upload.multipart.spec.ts`, `transactions-race.spec.ts`, `chats-ws-security.spec.ts`, `admin-security.spec.ts`

## 4. 보안 설계 요약

현재 구현은 다음 원칙을 반복 적용한다.

- 클라이언트가 보낸 `role`, `userId`, `sellerId`, `buyerId`, `amount`, `status`는 권한 판단에 쓰지 않는다.
- 요청 DTO는 전역 `ValidationPipe`의 whitelist와 non-whitelist 거부 정책을 통과해야 한다.
- 객체 단위 접근은 컨트롤러가 아니라 서비스 계층에서 DB의 소유자/참여자 필드와 현재 사용자를 비교한다.
- 검색과 목록 조회는 Prisma ORM 조건으로 작성되어 production 코드에서 raw unsafe SQL을 사용하지 않는다.
- 결제 금액은 거래와 상품의 DB 금액을 기준으로 대조한다.
- 공개 웹훅은 raw body HMAC 검증 후에도 DB의 결제 금액/상태와 다시 대조한다.
- 응답 DTO/select는 공개 사용자 정보 중심이며 비밀번호 해시, 내부 세션 값, 결제 secret을 선택하지 않는다.

## 5. 취약점 표현 원칙

보고서에서는 항목을 둘로 나눠 기록한다.

- **취약점 발견 및 패치**: 실제 구현 또는 QA에서 취약하거나 위험한 상태가 확인되고 후속 커밋으로 수정된 경우
- **위협 분석 및 방어 검증**: 현재 main에서 취약 코드가 확인되지 않았고, 자동 테스트와 정적 검색으로 방어를 확인한 경우

예를 들어 정지 사용자의 기존 인증 재사용 문제는 실제 패치 항목이다. 반면 SQL Injection, Stored XSS, 파일 업로드 대부분은 현재 main 기준 취약한 production 코드가 확인되지 않아 방어 검증 항목으로 분류했다.
