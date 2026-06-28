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

## Products API

Base URL: `/api/products`

- `GET /api/products`: 공개 상품 목록. `page`, `limit`, `sort=latest|priceAsc|priceDesc`, `category`, `min`, `max` 지원
- `GET /api/products/search`: 공개 검색. `q` 필수, Prisma `contains` 조건으로만 검색
- `GET /api/products/:id`: 공개 상세 조회, 숨김 상품 제외
- `POST /api/products`: 인증 필요. `title`, `price`, `description`, `category`, `region`만 허용
- `PATCH /api/products/:id`: 작성자만 수정 가능
- `DELETE /api/products/:id`: 작성자만 가능, `isHidden=true`와 `status=HIDDEN`으로 soft delete
- `PATCH /api/products/:id/status`: 작성자만 가능, `ON_SALE`, `RESERVED`, `SOLD`만 허용
- `POST /api/products/:id/images`: 작성자만 가능, jpg/jpeg/png/webp 이미지 업로드
- `POST /api/products/:id/favorite`: 인증 사용자 기준 찜 토글

Products 보안 정책:

- 클라이언트가 보낸 `sellerId`, `userId`, `status`, `isHidden`은 DTO에서 거부하거나 서버 값으로만 결정한다.
- 상품 등록의 `sellerId`와 찜의 `userId`는 access token subject에서만 가져온다.
- 상품 수정, 삭제, 상태 변경, 이미지 업로드는 서비스 레벨에서 `product.sellerId === currentUser.id`를 검증한다.
- 목록, 검색, 상세는 `isHidden=false` 상품만 반환한다.
- 검색은 Prisma ORM 조건만 사용하며 `$queryRawUnsafe`를 사용하지 않는다.
- 응답의 판매자 정보는 `id`, `nickname`, `avatarUrl`, `trustScore`, `completedTx`로 제한하고 `passwordHash`, `email`, `phone`은 조회하지 않는다.
- `price`는 정수 `0..100000000` 범위로 검증한다.
- 이미지 업로드는 5MB 이하, 요청당 최대 10개, 확장자+MIME+매직바이트를 검증한다. SVG/HTML/PHP/JSP 및 `shell.php.jpg` 같은 이중 확장자는 거부한다.
- 업로드 파일명은 UUID로 재생성하며 원본 파일명은 저장 경로에 사용하지 않는다. `UPLOAD_DIR`은 웹 루트 밖의 실행 불가 경로로 설정한다.

## Chats API

Base URL: `/api/chats`

- `POST /api/chats`: 인증 필요. `productId`만 허용하며 상품 판매자와 1:1 채팅방을 생성하거나 기존 방을 반환
- `GET /api/chats`: 인증 필요. 내가 buyer 또는 seller인 채팅방만 페이지네이션 조회
- `GET /api/chats/:id`: 인증 필요. 채팅 참여자만 상세 조회 가능
- `GET /api/chats/:id/messages`: 인증 필요. 참여자만 메시지 내역 조회 가능, `createdAt` 오름차순
- `POST /api/chats/:id/messages`: 인증 필요. 참여자만 `content`, `imageUrl` 메시지 전송 가능
- `POST /api/chats/:id/read`: 인증 필요. 상대방이 보낸 안 읽은 메시지만 읽음 처리

Chats 보안 정책:

- 채팅방 조회, 메시지 조회, 메시지 전송, 읽음 처리는 반드시 buyer 또는 seller 참여자만 가능하다.
- `buyerId`, `sellerId`, `senderId`, `userId`, `chatId`, `isRead` 같은 권한 필드는 클라이언트 본문에서 받지 않고 DTO에서 거부한다.
- `buyerId`, `sellerId`, `senderId`는 access token subject와 DB의 product/chat 관계에서만 결정한다.
- 채팅 상세와 메시지 응답의 사용자 정보는 `id`, `nickname`, `avatarUrl`, `trustScore`, `completedTx`로 제한하며 `passwordHash`, `email`, `phone`은 조회하지 않는다.
- 메시지 `content`는 HTML로 렌더링하지 않는 일반 문자열 데이터로 저장하고 반환한다. React에서는 기본 텍스트 바인딩을 사용한다.
- WebSocket `/ws`는 handshake token 인증 후 `join`, `message`, `read` 이벤트마다 서비스 레벨 참여자 검증을 수행한다.

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
