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
- Dev seed: 정상 기능 확인용 seller/buyer/admin, 상품/채팅/거래/후기 더미 데이터.

## 테스트

- Vitest mock 기반 unit/controller/DTO 테스트를 도메인별로 작성했다.
- 최근 전체 backend 테스트 결과는 22 files / 162 tests 통과.
- Backend lint/build, frontend build, Prisma validate를 실행해 정적 검증을 수행했다.
- Docker/DB 기반 검증까지 수행했다. `docker compose config`, `docker compose up -d`, Prisma migration, dev seed, backend start를 확인했다.

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
- 신고 생성은 `reporterId/status/adminId`를 body에서 받지 않고 서버가 결정한다. 중복 신고는 `Report @@unique([reporterId, type, targetId])`와 서비스 검사로 409 처리한다.
- 차단 관계는 `createChat`, `sendMessage`, `createTransaction`에 연결되어 양방향 Block이 있으면 403을 반환한다.
- 관리자 API는 `JwtAuthGuard + RolesGuard + @Roles(ADMIN)`로 보호하고 모든 관리자 조치를 `AdminLog`에 남긴다.
- 관리자 상품 restore는 기본 `HIDDEN -> ON_SALE`이지만, 활성/완료 거래가 있는 상품은 재판매 방지를 위해 409로 거부한다.
- 정지 사용자는 로그인/refresh와 Products, Chats, Transactions, Payments의 신규 변경 행위가 제한된다. 읽기 API는 본인 데이터 확인 목적상 허용한다.
- 관리자 목록/로그 응답은 passwordHash, token, secret, Toss key, refresh token, phone/email을 반환하지 않는다.

## 남은 작업

- Toss sandbox 개발자센터에서 실제 test key/webhook secret을 설정한 수동 결제 승인·취소 검증.
- 결제 UI는 `frontend/src/api/payments.ts` 기반으로 Toss Payment Widget 또는 checkout redirect 화면에서 확장.
