# 개발 로그

## 2026-06-28 / branch: feat/payments-secure-escrow

### Payments / 안전거래 구현

- 구현 기능:
  - `POST /api/payments`: 구매자 전용 안전결제 생성, 서버 기준 amount 저장, idempotency 재요청 처리, transaction `PAYMENT_PENDING` 전이.
  - `POST /api/payments/:id/approve`: Toss success URL의 `paymentKey/orderId/amount`를 DB와 대조한 뒤 Toss confirm API 호출, 승인 성공 시 `Payment.status=PAID`, `Transaction.status=PAID`.
  - `POST /api/payments/webhook`: 공개 endpoint이지만 raw body HMAC 서명 검증 후 처리, amount/status DB 대조, 중복 웹훅 idempotent 처리.
  - `POST /api/payments/:id/confirm`: 구매자 구매 확정, `escrowReleased=true`, 거래 완료, 상품 판매완료 전이.
  - `POST /api/payments/:id/refund`: 당사자 전용 환불, 구매 확정 후 일반 환불 제한, Toss cancel API adapter 연동.
  - `GET /api/payments/:id/receipt`: 거래 당사자 전용 영수증 조회, 민감 사용자 정보 제외.
  - Toss provider adapter와 mock 기반 unit test 분리.
  - frontend payments API wrapper 추가.
- DB 변경:
  - `PaymentStatus`에 `FAILED`, `CANCELED` 추가.
  - `Payment`에 `orderId`, `orderName`, `receiptUrl`, `paidAt`, `refundedAt`, `updatedAt` 추가.
  - migration `20260628050000_add_payments_toss_fields` 추가.
- 문서:
  - README, API spec, architecture, database design, security review log, test checklist, report notes 갱신.

### 테스트 결과

- `cd backend && npm install`: 통과, 취약 패키지 0건.
- `cd backend && npx prisma validate`: 통과.
- `cd backend && npm run lint`: 통과.
- `cd backend && npm run test`: 통과. 22 files / 162 tests.
- `cd backend && npm run build`: 통과.
- `cd backend && timeout 8s npm run start`: Nest application successfully started 및 Payments routes 매핑 확인 후 timeout 종료.
- `docker compose config`: 통과.
- `docker compose up -d`: 통과. Postgres/Redis running.
- `cd backend && npx prisma migrate status`: 최종 통과, database schema up to date.
- `cd backend && npm run db:seed`: 통과.
- `cd frontend && npm run build`: 통과.
- `git diff --check`: 통과.

### 미실행/환경 제약

- Toss sandbox 실제 카드/간편결제 승인·취소는 외부 test key와 webhook endpoint 설정이 필요해 unit test에서는 provider mock으로 검증했다.
- `npm run start`는 장기 실행 명령이라 프로세스를 남기지 않기 위해 timeout으로 종료했다.

## 2026-06-28 / branch: feat/transactions-secure-flow

### 커밋 기준 작업 요약

- `ed10555 chore(infra)`: NestJS/Prisma/PostgreSQL/Redis/React 기반 보안 중심 프로젝트 골격, 환경변수 검증, CORS/Helmet/ValidationPipe 기본값 구성.
- `0296390 feat(auth)`: 회원가입/로그인, bcrypt password hash, JWT access/refresh, refresh session rotation, 사용자 프로필 API 구현.
- `f29b135 feat(products)`: 상품 CRUD, 작성자 검증, 검색, 찜, 이미지 업로드 검증, 공개 응답 필드 제한 구현.
- `21b20b9 feat(chats)`: 채팅방 생성, 참여자 전용 조회/메시지/읽음 처리, WebSocket 참여자 검증, 메시지 XSS 방어 관점 테스트 구현.

### 현재 작업 트리: Transactions 후속 구현 및 정리

- 구현 기능:
  - 거래 요청, 예약, 취소, 완료, 내 거래 목록, 후기 작성 API 추가.
  - 거래 당사자 검증, 판매자 전용 전이 검증, 서버 상태 머신, 서버 기준 amount 저장.
  - 완료 거래 후기 중복 방지를 위한 `Review @@unique([transactionId, authorId])` schema 변경.
  - 정상 기능 확인용 dev seed 추가.
  - frontend transactions API 함수 추가.
  - stale `dist/src` 로드 문제 방지를 위해 backend `clean`/`prebuild` script와 seed build exclude 정리.
- 변경 파일:
  - `backend/src/modules/transactions/**`
  - `backend/src/app.module.ts`
  - `backend/prisma/schema.prisma`
  - `backend/prisma/seed.ts`
  - `backend/package.json`
  - `backend/tsconfig.build.json`
  - `frontend/src/api/transactions.ts`
  - `README.md`
  - `docs/report-requirements.md`
  - `docs/dev-log.md`
  - `docs/security-review-log.md`
  - `docs/test-checklist.md`
  - `docs/report-notes.md`

### 테스트 결과

- `cd backend && npm install`: 통과.
- `cd backend && npx prisma validate`: 통과.
- `cd backend && npm run lint`: 통과.
- `cd backend && npm run test`: 통과. 18 files / 138 tests.
- `cd backend && rm -rf dist && npm run build && npm run start`: 통과. Nest application successfully started 확인 후 검증용 timeout으로 종료.
- `docker compose config`: 통과.
- `docker compose up -d`: 통과. `whs-market-postgres`, `whs-market-redis` 모두 healthy.
- `cd backend && npx prisma migrate dev --name add-review-author-unique`: 통과. DB schema up to date, `_prisma_migrations`에 `20260628020031_add_review_author_unique` 완료 기록 확인.
- `cd backend && npm run db:seed`: 통과. `seller@example.com`, `buyer@example.com`, `admin@example.com` dev seed 완료.
- `cd frontend && npm run build`: 통과.
- `git diff --check`: 통과.

### 미실행/실패 검증 사유

- 없음. Docker, PostgreSQL, Redis가 동작하는 WSL 환경에서 compose, migration, seed, backend start까지 확인했다.
- `npm run start`는 장기 실행 서버 명령이므로 검증 중 프로세스를 남기지 않기 위해 timeout으로 종료했다.

### DB 검증 명령

```bash
docker compose config
docker compose up -d
cd backend
npx prisma migrate dev --name add-review-author-unique
npm run db:seed
npm run start
```
