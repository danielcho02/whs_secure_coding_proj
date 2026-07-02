# 보안 패치 타임라인

## 1. 전체 흐름

초기 골격은 보안 파이프라인을 먼저 세우고, 이후 도메인별로 상품, 채팅, 거래, 결제, 신고/관리자 기능을 구현했다. 2026-06-28에는 정지 사용자 기존 인증 재사용 문제가 실제 취약점으로 발견되어 패치되었다. 2026-07-02에는 보안 증거 테스트와 브라우저 QA 후속 수정이 보강되었다.

## 2. 타임라인 표

| 일시 | 커밋 | 개발 작업 | 관련 취약점 | 테스트 및 QA 결과 |
|---|---|---|---|---|
| 2026-06-27 18:13:51 +0900 | `ed10555` | NestJS/Fastify/Prisma/React 골격, Helmet/CORS/ValidationPipe 기반 구성 | Mass Assignment, 인증, CORS | 초기 skeleton 테스트 포함 |
| 2026-06-27 21:30:10 +0900 | `0296390` | bcrypt 기반 회원/로그인, refresh 세션 회전, 로그인 실패 잠금 | 세션 보안, 민감정보 노출, Rate Limit 보조 | auth service/controller 테스트 추가 |
| 2026-06-28 09:57:39 +0900 | `f29b135` | 상품 CRUD, 검색, 작성자 검증, 이미지 업로드 검증 | IDOR/BOLA, SQLi, XSS, 파일 업로드, Mass Assignment | product DTO/service/controller 테스트 |
| 2026-06-28 10:22:39 +0900 | `21b20b9` | 채팅 REST/WS, 참여자 검증, 메시지 저장 | IDOR/BOLA, Stored XSS, WS 인증 | chat service/gateway 테스트 |
| 2026-06-28 11:27:40 +0900 | `318c7ca` | 거래 요청/예약/취소/완료, 후기, 서버 기준 amount | 가격 조작, Race Condition, BOLA | 당시 18 files / 138 tests 통과 기록 |
| 2026-06-28 13:01:32 +0900 | `83b1967` | 안전결제 생성/승인/웹훅/환불/영수증 | 가격 조작, 웹훅 위조, 민감정보 노출 | 당시 22 files / 162 tests 및 frontend build 통과 기록 |
| 2026-06-28 13:01:41 +0900 | `e8890a9` | 결제 설정/환경 문서 보강 | 운영 설정, 결제 secret 분리 | 설정 문서와 env validation 연계 |
| 2026-06-28 13:32:50 +0900 | `4fa47c2` | 신고, 차단, 관리자 moderation, AdminLog | 관리자 권한 우회, Mass Assignment, 민감정보 노출 | 당시 29 files / 209 tests 통과 기록 |
| 2026-06-28 15:18:18 +0900 | `2df58b9` | DB status 재조회, inactive user HTTP/WS 차단, RolesGuard ACTIVE 요구 | **취약점 발견 및 패치**: 정지 사용자 기존 인증 재사용 | 당시 30 files / 216 tests, lint/build/start 통과 기록 |
| 2026-06-28 16:04:09 +0900 | `8a1982f` | 알림 API, CHAT 신고 target 검증 | 알림 IDOR, 신고 BOLA | 당시 33 files / 231 tests 통과 기록 |
| 2026-06-29 11:49:32 +0900 | `291211a` | gap API 보안 테스트 추가 | BOLA, 민감정보 노출 | transaction detail, favorites, my products 보안 테스트 |
| 2026-06-29 11:51:52 +0900 | `692c91b` | 거래 상세, 내 상품, 찜 목록 API 구현 | BOLA, Mass Assignment | 제3자 거래 상세 404, currentUser 기준 조회 |
| 2026-06-29 13:18:52 +0900 | `5e38d6d` | 브라우저 QA 1차 수정: 이미지 fallback, toast, 로그인 오류, 관리자 썸네일 | QA 기능 오류, 민감정보 표시 UX | 보안 취약점이 아니라 UI/운영성 결함으로 분류 |
| 2026-06-29 17:15:52 +0900 | `6ee3585` | 최종 브라우저 QA 수정: 채팅 dedup, 환불 종료 UI, 가격 검증, 알림 이동, placeholder image | QA 기능 오류, XSS sink 정적 점검 | frontend lint/build/security grep 통과 기록 |
| 2026-07-02 13:37:54 +0900 | `e180546` | 보안 smoke, multipart upload, race, WS, admin security 테스트와 QA fixes | 파일 업로드, Race, WS BOLA, AdminLog, session/security | 현재 주요 보안 증거 테스트 파일 추가 |
| 2026-07-02 14:31:47 +0900 | `981dfc3` | 결제/거래 리뷰 후속: 결제 provider 기본값, 거래 상세 action/role 처리 | 결제/거래 UI 오류, 운영 결제 모드 위험 | 현재 코드 기준 backend/frontend lint/build/test 재검증 통과 |
| 2026-07-02 14:32:37 +0900 | `4aed491` | `feat/secure-full-service-mvp` 병합 | 전체 보안 패치 통합 | 현재 `main` 및 문서 브랜치 기준 |
| 2026-07-02 작업 트리 | 미커밋 | 결제 전 `RESERVED` 거래 완료 차단, persisted `PAID` payment 검증, 보고서 리뷰 지적 반영 | 가격 조작/에스크로 상태 전이, 파일 생명주기 잔존 위험, AdminLog 원자성 | 42 files / 292 tests, backend/frontend lint/build, Prisma validate 통과 |

## 3. 최신 검증 결과

현재 체크아웃된 `4aed491` 기반 작업 트리에서 직접 실행한 결과:

- `cd backend && npm run lint`: 통과
- `cd backend && npm run test`: 42 files / 292 tests 통과
- `cd backend && npm run build`: 통과
- `cd frontend && npm run lint`: 통과
- `cd frontend && npm run build`: 통과
- `cd backend && npx prisma validate`: 통과. Prisma 7 deprecation warning만 표시

## 4. 과거 기록과 현재 기록의 차이

중간 보안 증거 보강 시점에는 39 files / 275 tests 기록이 있었지만, 현재 작업 트리에서 실제 실행한 결과는 42 files / 292 tests다. 최종 보고서에는 현재 실행값을 기준으로 삼고, 과거 수치는 커밋 당시의 진행 기록으로만 다룬다.
