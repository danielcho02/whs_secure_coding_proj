# 테스트 체크리스트

## Auth

- DTO validation: 이메일/비밀번호/닉네임 검증, role/status 등 권한 필드 주입 거부.
- Service: bcrypt hash 저장, 로그인 실패 처리, refresh token rotation, logout/session 제거.
- Controller: 인증 관련 route 동작 및 guard wiring 검증.
- JwtAuthGuard: JWT payload는 `sub` 식별 힌트로만 사용하고 DB의 `id/email/role/status`로 `request.user`를 채우는지 검증.
- JwtAuthGuard: 유효한 accessToken이어도 DB `User.status=SUSPENDED`이면 401.

## Products

- DTO validation: `sellerId`, `status`, `isHidden`, `userId` 주입 거부, 가격 범위 검증.
- Service: 작성자 검증, 숨김 상품 제외, Prisma 검색 조건 사용, 이미지 업로드 검증, 민감정보 응답 제외.
- Controller: 인증 필요한 route의 `JwtAuthGuard` 적용 검증.

## Chats

- DTO validation: `buyerId`, `sellerId`, `senderId`, `chatId`, `isRead` 주입 거부.
- Service: 참여자 전용 조회/메시지/읽음 처리, XSS payload 일반 문자열 처리, 민감정보 응답 제외.
- Gateway/Controller: WebSocket DB status 재확인, 참여자 검증 경로와 HTTP guard 적용 검증.
- Gateway: DB `User.status=SUSPENDED` 사용자 연결은 disconnect, ACTIVE 사용자 연결은 허용.

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
- Reports DTO: `targetType=CHAT` 허용.
- Reports Service: USER/PRODUCT 신고 생성 성공, 존재하지 않는 대상 404, 자기 자신 신고 400, 자기 상품 신고 400, 중복 신고 409.
- Reports Service: CHAT 신고는 `ChatMessage.id` 기준, 참여자만 상대 메시지를 신고할 수 있고 비참여자/자기 메시지는 거부.
- Reports Service: DB `User.status=SUSPENDED` 사용자의 신고 생성 403.
- Reports Service: 내 신고 목록은 current user의 신고만 반환.
- Blocks DTO: `blockerId`, `status`, `role` 주입 400.
- Blocks Service: 차단 생성 성공, 자기 자신 차단 400, 중복 차단 기존 Block 반환, 해제는 current user 관계만 삭제.
- Chats/Transactions: 차단 후 `createChat`, `sendMessage`, `createTransaction` 403.
- Admin Controllers: 모든 admin controller에 `JwtAuthGuard + RolesGuard + @Roles(ADMIN)` 적용.
- RolesGuard: `ADMIN + SUSPENDED`는 403, `ADMIN + ACTIVE`는 통과, `USER + ACTIVE`는 관리자 API 403.
- Admin Service: 신고 목록/상세 조회, 신고 상태 변경과 AdminLog 생성.
- Admin Service: 상품 hide/restore와 AdminLog 생성, restore 시 활성/완료 거래 상품 재판매 방지.
- Admin Service: 사용자 suspend/restore와 AdminLog 생성, 자기 자신 suspend 거부, 마지막 ACTIVE 관리자 suspend 거부.
- Suspended users: 기존 accessToken이 남아 있어도 HTTP API는 401, WebSocket 연결은 disconnect.
- Admin Logs: pagination 조회 성공, actor/action/targetType/targetId/reason/createdAt 반환, 민감정보 제외.
- Static: 신규 모듈 및 연결 제한에서 `$queryRawUnsafe` 사용 없음.

## Notifications

- DTO validation: `page`, `limit`, `unreadOnly`만 허용하고 `userId` 주입 400.
- Controller: `GET /notifications`, `POST /notifications/:id/read` 모두 `JwtAuthGuard` 적용, `:id`는 UUID 검증.
- Service: 목록은 current user의 알림만 반환하고 `unreadOnly=true`면 `isRead=false` 조건 추가.
- Service: 읽음 처리는 `notification.userId === currentUser.id` 조건으로만 수행.
- Service: 타인 알림 read는 404, 이미 읽은 알림 read 재요청은 idempotent.
- Static: Notifications 모듈에서 `$queryRawUnsafe` 사용 없음.

## 최근 실행 결과

- Backend install: `npm install` 통과. 취약 패키지 0건.
- Backend lint: `npm run lint` 통과.
- Backend test: `npm run test` 통과. 33 files / 231 tests.
- Backend build: `npm run build` 통과.
- Frontend build: 미실행. 이번 작업에서 frontend 파일은 변경하지 않았다.
- Prisma validate: `npx prisma validate` 통과.
- Backend start: `timeout 8s npm run start`에서 Nest application successfully started 및 Notifications route 매핑 확인, timeout으로 종료.
- Docker/DB: `docker compose config`, `docker compose up -d`, `npx prisma migrate deploy`, `npx prisma migrate status`, `npm run db:seed` 통과.
- Static search: `rg '\$queryRawUnsafe|\$queryRaw' backend/src`에서 production 코드 사용 없음. spec mock과 미호출 검증만 확인.
- Static search: `rg 'passwordHash|refreshToken|TOSS_SECRET|SECRET_KEY' backend/src/modules backend/src/common`에서 auth password/refresh 처리와 민감정보 미노출 테스트만 확인, Toss secret/key 하드코딩 없음.

## 미실행/환경 제약

- Toss sandbox 실제 승인/취소는 외부 test key와 webhook endpoint 설정이 필요해 자동 검증하지 않았다. Unit test는 provider mock으로 수행했다.
- `npm run start`는 서버가 계속 실행되는 명령이라 프로세스를 남기지 않기 위해 timeout으로 종료했다.
