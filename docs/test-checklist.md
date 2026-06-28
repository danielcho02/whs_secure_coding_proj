# 테스트 체크리스트

## Auth

- DTO validation: 이메일/비밀번호/닉네임 검증, role/status 등 권한 필드 주입 거부.
- Service: bcrypt hash 저장, 로그인 실패 처리, refresh token rotation, logout/session 제거.
- Controller: 인증 관련 route 동작 및 guard wiring 검증.

## Products

- DTO validation: `sellerId`, `status`, `isHidden`, `userId` 주입 거부, 가격 범위 검증.
- Service: 작성자 검증, 숨김 상품 제외, Prisma 검색 조건 사용, 이미지 업로드 검증, 민감정보 응답 제외.
- Controller: 인증 필요한 route의 `JwtAuthGuard` 적용 검증.

## Chats

- DTO validation: `buyerId`, `sellerId`, `senderId`, `chatId`, `isRead` 주입 거부.
- Service: 참여자 전용 조회/메시지/읽음 처리, XSS payload 일반 문자열 처리, 민감정보 응답 제외.
- Gateway/Controller: WebSocket 참여자 검증 경로와 HTTP guard 적용 검증.

## Transactions

- DTO validation: `buyerId`, `sellerId`, `amount`, `status`, `authorId`, `targetId`, `transactionId` 주입 거부, rating/pagination 범위 검증.
- Service: 거래 요청, 자기 상품/숨김/SOLD/중복 진행 거래 거부, 서버 기준 amount 저장.
- Service: 예약/취소/완료 권한과 상태 전이 검증, product status 동기화, 당사자 목록 필터, 중복 후기 거부, 민감정보 응답 제외.
- Controller: 6개 transactions route 모두 `JwtAuthGuard` 적용 검증.

## Payments

- DTO validation: `POST /payments`는 `transactionId`, `idempotencyKey`만 허용하고 amount/buyerId/userId/status 주입을 거부.
- Controller: 결제 생성, Toss 승인, 구매 확정, 환불, 영수증 조회는 `JwtAuthGuard` 적용. webhook은 공개 route로 두되 서명 검증을 service에서 강제.
- Service: 구매자만 결제 생성 가능, 서버 금액 기준으로 Payment.amount 저장, 동일 idempotencyKey 재요청 idempotent 처리, 다른 idempotencyKey 중복 결제 거부.
- Service: Toss approve amount mismatch 거부, 승인 성공 시 `Payment.status=PAID`, `Transaction.status=PAID`.
- Service: webhook 서명 불일치 401, 중복 webhook idempotent 처리.
- Service: 구매 확정 시 `escrowReleased=true`, `Transaction.status=COMPLETED`, `Product.status=SOLD`.
- Service: 환불은 당사자만 가능하고 `escrowReleased=true` 이후 일반 환불 제한.
- Service: receipt는 당사자만 조회 가능하고 민감정보 미포함.
- Static: Payments 모듈에서 `$queryRawUnsafe` 사용 없음.

## Reports / Blocks / Admin Moderation

- Reports DTO: `reporterId`, `status`, `adminId`, `role` 주입 400.
- Reports Service: USER/PRODUCT 신고 생성 성공, 존재하지 않는 대상 404, 자기 자신 신고 400, 자기 상품 신고 400, 중복 신고 409.
- Reports Service: 내 신고 목록은 current user의 신고만 반환.
- Blocks DTO: `blockerId`, `status`, `role` 주입 400.
- Blocks Service: 차단 생성 성공, 자기 자신 차단 400, 중복 차단 기존 Block 반환, 해제는 current user 관계만 삭제.
- Chats/Transactions: 차단 후 `createChat`, `sendMessage`, `createTransaction` 403.
- Admin Controllers: 모든 admin controller에 `JwtAuthGuard + RolesGuard + @Roles(ADMIN)` 적용.
- Admin Service: 신고 목록/상세 조회, 신고 상태 변경과 AdminLog 생성.
- Admin Service: 상품 hide/restore와 AdminLog 생성, restore 시 활성/완료 거래 상품 재판매 방지.
- Admin Service: 사용자 suspend/restore와 AdminLog 생성, 자기 자신 suspend 거부, 마지막 ACTIVE 관리자 suspend 거부.
- Suspended users: Products/Chats/Transactions/Payments 주요 변경 행위 403.
- Admin Logs: pagination 조회 성공, actor/action/targetType/targetId/reason/createdAt 반환, 민감정보 제외.
- Static: 신규 모듈 및 연결 제한에서 `$queryRawUnsafe` 사용 없음.

## 최근 실행 결과

- Backend test: `npm run test` 통과. 29 files / 209 tests.
- Backend lint: `npm run lint` 통과.
- Backend build: `npm run build` 통과.
- Frontend build: 미실행. 이번 작업에서 frontend 파일은 변경하지 않았다.
- Prisma validate: `npx prisma validate` 통과.
- Docker compose config: `docker compose config` 통과.
- Docker compose up: `docker compose up -d` 통과. Postgres/Redis running.
- Prisma migration: 최초 `npx prisma migrate status`에서 `20260628090000_add_reports_admin_moderation` 미적용 확인 후 `npx prisma migrate deploy`로 적용. 최종 `npx prisma migrate status` 통과.
- Dev seed: `npm run db:seed` 통과.
- Backend start: `timeout 8s npm run start`로 Nest application successfully started 및 Reports/Blocks/Admin routes 매핑 확인 후 timeout으로 종료.
- Diff whitespace: `git diff --check` 통과.

## 미실행/환경 제약

- Toss sandbox 실제 승인/취소는 외부 test key와 webhook endpoint 설정이 필요해 자동 검증하지 않았다. Unit test는 provider mock으로 수행했다.
- `npm run start`는 서버가 계속 실행되는 명령이라 프로세스를 남기지 않기 위해 timeout으로 종료했다.
