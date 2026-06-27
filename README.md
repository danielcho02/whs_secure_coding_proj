# SecondHand Market

Security-first secondhand marketplace skeleton.

## Development

```bash
docker compose up -d
```

Backend:

```bash
cd backend
cp .env.example .env
npm install
npx prisma validate
npm run start:dev
```

## Auth API

Base URL: `/api`

- `POST /api/auth/register`: email, password, nickname으로 회원가입
- `POST /api/auth/login`: access token 발급, refresh token은 httpOnly cookie로 설정
- `POST /api/auth/refresh`: refresh cookie 검증 후 access/refresh token 회전
- `POST /api/auth/logout`: refresh 세션 무효화 및 cookie 삭제
- `GET /api/users/me`: 내 프로필 조회, Bearer access token 필요
- `PATCH /api/users/me`: nickname, bio, avatarUrl만 수정
- `GET /api/users/:id`: 공개 프로필 조회
- `GET /api/users/:id/private`: 본인 또는 ADMIN만 private 프로필 조회

## Backend Environment

Required backend env values:

```bash
DATABASE_URL=postgresql://market_user:market_password@localhost:5432/market
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=change-me
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_SECRET=change-me
JWT_REFRESH_EXPIRES=7d
CORS_ORIGIN=http://localhost:5173
PG_WEBHOOK_SECRET=change-me
LOGIN_MAX_ATTEMPTS=5
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX=100
```

Use real secrets only in local `.env` or deployment secret storage. Do not commit real secret values.

## Token Storage Policy

Refresh tokens are set as `refreshToken` cookies with `httpOnly: true`, `sameSite: strict`, `secure: true` in production, and `path: /api/auth`. Refresh token JTIs are stored in Redis and rotated on every refresh.

Do not store access tokens in `localStorage`. Keep them in memory on the client and refresh through the httpOnly cookie.

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Pre-Commit Verification

```bash
docker compose config
cd backend
npm install
npx prisma validate
npm run lint
npm run test
npm run build
cd frontend && npm run build
```

No real `.env` files or secrets should be committed. API endpoints must follow `docs/api-spec.md`; this bootstrap only creates the secure skeleton.
