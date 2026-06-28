# 개발 로그

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
