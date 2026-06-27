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

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Pre-Commit Verification

```bash
docker compose config
cd backend && npm run lint && npm run test && npx prisma validate
cd frontend && npm run build
```

No real `.env` files or secrets should be committed. API endpoints must follow `docs/api-spec.md`; this bootstrap only creates the secure skeleton.
