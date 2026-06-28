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

## 최근 실행 결과

- Backend test: `npm run test` 통과. 18 files / 138 tests.
- Backend lint: `npm run lint` 통과.
- Backend build: `npm run build` 통과.
- Frontend build: `npm run build` 통과.
- Prisma validate: `npx prisma validate` 통과.
- Docker compose config: `docker compose config` 통과.
- Docker compose up: `docker compose up -d` 통과. Postgres/Redis healthy.
- Prisma migration: `npx prisma migrate dev --name add-review-author-unique` 통과. `20260628020031_add_review_author_unique` 완료 기록 확인.
- Dev seed: `npm run db:seed` 통과.
- Backend start: `npm run start` 통과. Nest application successfully started 확인 후 timeout으로 종료.
- Diff whitespace: `git diff --check` 통과.

## 미실행/환경 제약

- 없음. Docker/DB 기반 검증까지 실행했다.
- `npm run start`는 서버가 계속 실행되는 명령이라 프로세스를 남기지 않기 위해 timeout으로 종료했다.
