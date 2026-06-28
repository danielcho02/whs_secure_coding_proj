# 최종 보고서 작성 메모

## 요구사항 분석

- 중고거래 서비스의 핵심 도메인을 Auth, Users, Products, Chats, Transactions로 분리했다.
- 요구사항은 `docs/requirements.md`의 FR/SR ID와 연결했다.
- Transactions 작업은 FR-23 거래 요청, FR-24 예약, FR-25 취소, FR-26 완료, FR-27 내역, FR-28 후기, FR-29 상태 관리를 대상으로 했다.
- 보안 요구사항은 SR-08, SR-10, SR-11, SR-14, SR-15, SR-26, SR-35, SR-39를 우선 적용했다.

## 설계

- NestJS 모듈 구조를 도메인별로 분리하고 controller는 routing/guard/DTO, service는 권한/상태/DB 로직을 담당한다.
- Prisma schema는 User, Product, Chat, Transaction, Review 관계를 기준으로 설계했다.
- 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`로 mass assignment를 방어한다.
- 거래 상태 전이는 서버 상태 머신으로만 수행하고, 상품 상태와 거래 상태 변경은 Prisma `$transaction`에서 함께 처리한다.

## 구현

- Auth: bcrypt password hash, JWT access/refresh, Redis refresh session, 사용자 프로필 API.
- Products: 상품 CRUD, 작성자 검증, 검색, 찜, 이미지 업로드 검증, 민감정보 제외 응답.
- Chats: 상품별 1:1 채팅방, 참여자 전용 조회/메시지/읽음 처리, WebSocket 참여자 검증.
- Transactions: 거래 요청/예약/취소/완료/목록/후기 API, 서버 기준 amount, 당사자 검증, 중복 진행 거래 및 중복 후기 방지.
- Payments: Toss Payments sandbox/test 기반 안전결제 생성, Toss 승인 confirm adapter, 웹훅 서명 검증, 에스크로 구매 확정, 환불, 영수증 조회 API.
- Reports/Blocks/Admin: 사용자/상품 신고, 사용자 차단, 관리자 신고 처리, 상품 hide/restore, 사용자 suspend/restore, 관리자 로그 조회 API.
- Notifications: 프론트 전 백엔드 최종 감사에서 누락된 알림 목록/읽음 API를 발견하고, 본인 알림 조회와 BOLA 방어를 추가했다.
- Dev seed: 정상 기능 확인용 seller/buyer/admin, 상품/채팅/거래/후기 더미 데이터.

## 테스트

- Vitest mock 기반 unit/controller/DTO 테스트를 도메인별로 작성했다.
- 최근 전체 backend 테스트 결과는 33 files / 231 tests 통과.
- Backend `npm install`, Prisma validate, lint, test, build를 실행해 정적 검증을 수행했다.
- Docker/DB 기반 start 검증은 DB 미기동 상태에서 Prisma P1001을 확인한 뒤 `docker compose up -d`로 Postgres/Redis를 시작하고 `timeout 8s npm run start`에서 Nest application successfully started를 확인했다.

## 보안 고려사항

- 클라이언트가 보낸 userId, role, amount, price, status를 신뢰하지 않는다.
- 객체 ID 기반 API는 DB의 소유자/참여자 필드와 current user id로 검증한다.
- 응답에서 passwordHash, email, phone 등 민감정보를 선택하지 않는다.
- 검색은 Prisma ORM 조건만 사용하고 unsafe raw query를 사용하지 않는다.
- 파일 업로드는 확장자, MIME, 매직바이트, 크기, 이중 확장자를 검증한다.
- 거래 완료 이후 일반 취소를 거부해 환불/결제 흐름과 분리한다.
- 결제 생성은 amount를 body에서 받지 않고 서버 DB의 transaction/product 금액을 대조한다.
- Toss success URL의 amount도 신뢰하지 않고 confirm API 호출 전 DB 금액과 비교한다.
- Webhook은 공개 endpoint지만 HMAC 서명 검증과 DB 대조를 통과해야 상태를 반영한다.
- 구매 확정 전에는 `escrowReleased=false`로 정산을 보류하고, 구매자 확정 이후에만 `true`로 바꾼다.
- 신고 생성은 `reporterId/status/adminId`를 body에서 받지 않고 서버가 결정한다. 중복 신고는 `Report @@unique([reporterId, type, targetId])`와 서비스 검사로 409 처리하며, 정지된 사용자의 신고 생성은 403으로 차단한다.
- `CHAT` 신고는 `ChatMessage.id`를 대상으로 하며, 채팅 참여자만 상대 메시지를 신고할 수 있다.
- 차단 관계는 `createChat`, `sendMessage`, `createTransaction`에 연결되어 양방향 Block이 있으면 403을 반환한다.
- 알림 API는 `userId`를 body/query에서 받지 않고 `notification.userId === currentUser.id` 조건으로만 목록/읽음 처리를 수행한다. 타인 알림 id는 404로 처리한다.
- 관리자 API는 `JwtAuthGuard + RolesGuard + @Roles(ADMIN)`로 보호하고 모든 관리자 조치를 `AdminLog`에 남긴다. 관리자 API는 ADMIN role뿐 아니라 `User.status=ACTIVE`도 요구한다.
- 관리자 상품 restore는 기본 `HIDDEN -> ON_SALE`이지만, 활성/완료 거래가 있는 상품은 재판매 방지를 위해 409로 거부한다.
- 정지 사용자는 로그인/refresh와 기존 accessToken 기반 HTTP API, WebSocket 연결에서 차단된다.
- 관리자 목록/로그 응답은 passwordHash, token, secret, Toss key, refresh token, phone/email을 반환하지 않는다.

## 보안 패치 사례: 정지 사용자 기존 accessToken 재사용

보고서용 요약 문장:

> 보안 검토 과정에서 JWT 인증 가드가 토큰 서명만 검증하고 DB의 사용자 상태를 재확인하지 않는 문제가 발견되었다. 이로 인해 정지된 사용자가 기존 accessToken이 만료되기 전까지 일부 API에 접근할 수 있는 위험이 있었다. 패치에서는 JwtAuthGuard와 WebSocket 인증 흐름에서 사용자 상태를 DB 기준으로 재확인하고, 관리자 API는 role뿐 아니라 ACTIVE 상태를 요구하도록 수정하였다.

### 취약점 발견

- 기존 `JwtAuthGuard`와 `ChatsGateway`는 JWT 서명을 검증한 뒤 payload의 `sub/email/role`을 그대로 `request.user` 또는 `socket.data.user`에 저장했다.
- `RolesGuard`는 `role=ADMIN` 여부만 확인하고 DB의 최신 `User.status`를 확인하지 않았다.
- 따라서 사용자가 `SUSPENDED`/`BANNED`/`WITHDRAWN` 처리되어도 기존 accessToken 또는 WebSocket token이 만료되기 전까지 일부 API 접근 위험이 남았다.

### 원인

- JWT payload를 최신 권한 정보처럼 사용했다.
- 권한 판단 시 DB의 `User.status`를 매 요청 재확인하지 않았다.
- 관리자 API도 role만 기준으로 삼아 정지된 ADMIN 토큰을 차단하지 못할 수 있었다.

### 영향

- 정지된 일반 사용자가 기존 accessToken으로 상품, 채팅, 거래, 신고 등 일부 기능에 접근할 수 있었다.
- 정지된 관리자가 기존 ADMIN 토큰으로 `/api/admin/*` 관리자 API를 호출할 수 있었다.
- WebSocket 연결에서 정지 사용자가 `join`, `read`, `message` 이벤트를 계속 사용할 수 있었다.

### 패치

- `JwtAuthGuard`는 JWT payload를 `sub` 식별 힌트로만 사용하고 DB에서 `id/email/role/status`를 재조회한다.
- DB User가 없거나 `status !== ACTIVE`이면 HTTP API 요청을 401로 거부한다.
- `request.user`는 JWT payload가 아니라 DB에서 조회한 값으로만 채운다.
- `RolesGuard`는 role 검사 전에 `request.user.status === ACTIVE`를 요구한다.
- `ChatsGateway`는 연결 시 DB status를 재확인하고 inactive user는 즉시 disconnect한다.
- `ReportsService`는 신고 생성 초입에서 reporter가 ACTIVE인지 확인하고 정지 사용자는 403으로 거부한다.
- 사용하지 않는 `OwnershipGuard`는 삭제하고, 객체별 권한 검증은 service-level ownership/participant validation이 표준임을 문서화했다.

### 검증 결과

- `SUSPENDED` 사용자의 유효한 accessToken이 `JwtAuthGuard`에서 401 처리되는 테스트를 추가했다.
- ACTIVE 사용자는 기존 HTTP 인증 플로우가 유지되고, `request.user.role/status`가 JWT payload가 아니라 DB 값으로 채워지는 테스트를 추가했다.
- `SUSPENDED ADMIN`의 관리자 API 접근이 `RolesGuard`에서 403 처리되는 테스트를 추가했다.
- `ACTIVE ADMIN`은 관리자 API guard를 통과하고, `ACTIVE USER`는 403 처리되는 테스트를 추가했다.
- `SUSPENDED` 사용자의 WebSocket 연결이 거부/disconnect되는 테스트를 추가했다.
- `SUSPENDED` 사용자의 신고 생성이 403 처리되는 테스트를 추가했다.
- 전체 backend 검증은 `npm run lint`, `npm run test`(30 files / 216 tests), `npm run build`, `timeout 8s npm run start`로 통과했다.
- 추가 검색에서 `$queryRawUnsafe`는 production 코드가 아니라 spec mock과 미호출 검증에서만 확인되었고, Toss secret/key 하드코딩은 발견되지 않았다.

## 남은 작업

- Toss sandbox 개발자센터에서 실제 test key/webhook secret을 설정한 수동 결제 승인·취소 검증.
- 결제 UI는 `frontend/src/api/payments.ts` 기반으로 Toss Payment Widget 또는 checkout redirect 화면에서 확장.
