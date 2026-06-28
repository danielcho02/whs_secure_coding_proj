# SecondHand Market — 보안 중심 중고거래 웹 서비스

당근마켓형 중고거래 플랫폼. 상품 등록, 1:1 채팅, 거래 예약, 안전결제(에스크로 시뮬레이션), 신고/관리자 기능을 제공하며, **개발 후 주요 취약점을 분석하고 보안 패치를 적용**하는 것을 핵심 목표로 한다.

보안 기준은 OWASP Top 10, OWASP API Security Top 10, OWASP ASVS를 따른다. 중고거래 서비스는 상품 ID·채팅방 ID·거래 ID를 API로 직접 다루므로 **BOLA/IDOR(객체 단위 권한 검사)** 가 최우선 위험이다.

---

## 1. 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| 백엔드 | **NestJS (Node.js + TypeScript)** | Guard/Pipe/Interceptor로 접근제어·검증을 선언적으로 강제, 에이전트가 구조 예측 쉬움 |
| ORM | **Prisma** | 타입 안전, Prepared Statement 자동화로 SQLi 차단 |
| DB | **PostgreSQL** | 트랜잭션·락 지원(Race Condition 방어), JSONB |
| 캐시/세션/레이트리밋 | **Redis** | 로그인 실패 카운트, Rate Limit, 토큰 블랙리스트 |
| 프론트엔드 | **React + Vite + TypeScript** | 컴포넌트 단위 출력 인코딩(XSS 방어), 에이전트 친화 |
| 실시간 채팅 | **Socket.IO (WebSocket)** | JWT 핸드셰이크 인증 |
| 인증 | **JWT 액세스(15분) + 리프레시 토큰(httpOnly 쿠키, 회전)** | XSS 토큰 탈취 표면 축소 + 세션 무효화 가능 |
| 파일 저장 | 로컬 `/uploads` (실행 불가 경로) 또는 S3 | 업로드 파일 실행 차단 |
| 검증 | `class-validator` + `class-transformer` | DTO 화이트리스트(Mass Assignment 방어) |

> 인증 방식 결정 근거: 액세스 토큰은 프론트 메모리에만 보관, 리프레시 토큰은 `HttpOnly; Secure; SameSite=Strict` 쿠키로 보관·회전한다. localStorage에 토큰을 두지 않아 Stored XSS로 인한 탈취를 막고, 서버는 리프레시 토큰 화이트리스트(Redis)로 로그아웃·강제 만료를 처리한다(SR-04).

---

## 2. 폴더 구조

```
secondhand-market/
├── backend/                  # NestJS
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/         # 회원가입/로그인/토큰
│   │   │   ├── users/        # 프로필, 신뢰도, 계정 상태
│   │   │   ├── products/     # 상품 CRUD, 이미지, 검색, 찜
│   │   │   ├── chats/        # 채팅방, 메시지, 차단
│   │   │   ├── transactions/ # 거래 요청/예약/완료, 후기
│   │   │   ├── payments/     # 안전결제, 에스크로, 환불, 웹훅
│   │   │   ├── reports/      # 신고
│   │   │   ├── admin/        # 관리자 전용
│   │   │   └── notifications/
│   │   ├── common/
│   │   │   ├── guards/       # JwtAuthGuard, RolesGuard
│   │   │   ├── interceptors/ # 응답 필드 필터(SR-39), 감사로그
│   │   │   ├── pipes/        # ValidationPipe(whitelist)
│   │   │   ├── filters/      # 전역 에러 필터(SR/NFR-07)
│   │   │   └── decorators/   # @CurrentUser, @Roles
│   │   ├── config/           # 환경변수 스키마 검증
│   │   └── main.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── test/                 # 단위/통합/보안 테스트
├── frontend/                 # React + Vite
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── api/              # axios 인스턴스(인터셉터)
│       └── hooks/
├── docs/                     # 본 문서 세트
└── docker-compose.yml        # postgres, redis
```

---

## 3. 실행 방법

```bash
# 1. 인프라 기동
docker compose up -d            # postgres, redis

# 2. 백엔드
cd backend
cp .env.example .env            # 환경변수 분리(NFR-10)
npm install
npx prisma migrate dev
npm run start:dev               # http://localhost:3000

# 3. 프론트엔드
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

---

## 4. 환경변수 (`.env.example`)

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/market
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=change-me
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_SECRET=change-me
JWT_REFRESH_EXPIRES=7d

CORS_ORIGIN=http://localhost:5173
UPLOAD_DIR=/var/app/uploads      # 웹 루트 밖, 실행 불가
MAX_UPLOAD_SIZE=5242880          # 5MB

PG_WEBHOOK_SECRET=change-me      # legacy 결제 웹훅 secret fallback
TOSS_CLIENT_KEY=test_ck_change-me
TOSS_SECRET_KEY=test_sk_change-me
TOSS_WEBHOOK_SECRET=change-me
PAYMENT_SUCCESS_URL=http://localhost:5173/payments/success
PAYMENT_FAIL_URL=http://localhost:5173/payments/fail
PAYMENT_CANCEL_URL=http://localhost:5173/payments/cancel
FRONTEND_ORIGIN=http://localhost:5173
LOGIN_MAX_ATTEMPTS=5
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX=100
```

> 운영/개발 환경변수는 분리하고, 시크릿은 절대 커밋하지 않는다(NFR-10, SR-31).

---

## 5. 문서 인덱스

| 문서 | 내용 |
|------|------|
| `requirements.md` | 기능/비기능/보안 요구사항 |
| `architecture.md` | 시스템 구조, 인증 흐름, 도메인 분리 |
| `database-design.md` | ERD, 테이블 스키마 |
| `api-spec.md` | REST API 명세 |
| `security-spec.md` | 위협 모델링, 취약점 분석·재현·패치 |
| `coding-conventions.md` | 코딩 규칙, 커밋 규칙, 테스트 |
| `CLAUDE.md` / `AGENT.md` | 코딩 에이전트용 작업 지침 |

---

## 6. MVP 범위

**필수**: 회원가입/로그인 · 상품 CRUD · 이미지 업로드 · 검색 · 1:1 채팅 · 거래 요청/예약/완료 · 안전결제 시뮬레이션 · 신고 · 관리자 페이지 · 취약점 분석·패치 보고서

**선택**: 위치 기반 거래 · 찜 · 후기/평점 · 알림 · 금지어 필터 · 신뢰도 점수 · 환불/분쟁

**메인 분석 취약점 6종**: IDOR/BOLA → XSS → SQL Injection → 파일 업로드 → 결제 금액 조작 → 관리자 권한 우회
