# 테스트 및 QA

## 1. 조사 기준

이 문서는 현재 브랜치 `docs/security-patch-report`에서 확인한 `main` 기준 코드, 테스트, Git 이력, `docs/report-prep` 문서를 근거로 작성했다. 조사 시점의 기준 커밋은 `4aed491`이며, `main`과 현재 문서 브랜치는 같은 커밋을 가리키고 있었다.

QA 기록은 보안 취약점과 기능 오류를 분리해서 해석했다. 브라우저에서 발견된 이미지 표시, 거래 화면 action, 안내 문구, 준비 중 화면 문제는 사용자 경험과 운영 안정성에는 영향을 주지만, 자동으로 취약점으로 분류하지 않았다. 보안 취약점으로 분류한 항목은 코드 경로와 테스트가 함께 확인된 경우로 한정했다.

## 2. 최초 자동 보안 테스트

`docs/report-prep/security-test-plan.md`에는 보안 증거 보강 시점의 자동 검증 기록이 남아 있다. 당시 기록은 다음 범위를 다뤘다.

| 항목 | 증거 파일 | 검증 내용 |
|---|---|---|
| Chat WS handshake 인증 | `backend/src/modules/chats/chats-ws-security.spec.ts` | 토큰 없음/잘못된 JWT 거부, JWT subject 기준 사용자 식별 |
| Chat WS BOLA | `backend/src/modules/chats/chats-ws-security.spec.ts` | 비참여자 join/message 거부, room join/broadcast 미수행 |
| Chat WS Mass Assignment | `backend/src/modules/chats/chats-ws-security.spec.ts` | `senderId`, `userId`, `role` payload 주입 거부 |
| Chat Stored XSS | `backend/src/modules/chats/chats-ws-security.spec.ts`, `chats.service.spec.ts` | HTML/script payload를 문자열 content로만 저장/전달 |
| 관리자 USER 접근 차단 | `backend/src/modules/admin/admin-security.spec.ts`, `roles.guard.spec.ts` | ACTIVE USER가 ADMIN route guard를 통과하지 못함 |
| 관리자 액션 로그 | `backend/src/modules/admin/admin-security.spec.ts`, `admin.service.spec.ts` | 상품 숨김, 사용자 제재, 신고 처리 시 AdminLog 생성 |
| 관리자 Mass Assignment | `backend/src/modules/admin/admin-security.spec.ts`, `admin.dto.spec.ts` | `role`, `status`, `adminId`, `reporterId` 주입 거부 |
| 토큰 저장소 정적 점검 | `frontend/src/api/client.ts`와 grep 결과 | access token을 브라우저 영구 저장소에 저장하는 코드 미발견 |
| XSS sink 정적 점검 | frontend/backend grep 결과 | production 코드에서 `dangerouslySetInnerHTML`/`innerHTML` sink 미발견 |

중간 보안 증거 보강 당시 자동 테스트 수는 39 files / 275 tests였다. 이후 `e180546`, `981dfc3` 후속 변경과 결제 전 완료 차단 테스트 추가를 거쳐 최종 값은 42 files / 292 tests로 증가했다. 최종 보고서에는 현재 직접 실행한 42 files / 292 tests를 기준으로 삼는다.

## 3. 브라우저 QA에서 발견된 상품 등록 및 이미지 문제

브라우저 QA에서 확인된 상품/이미지 관련 문제는 주로 기능 오류와 복구 흐름 문제였다.

| 커밋 | 문제 | 후속 조치 | 보안 해석 |
|---|---|---|---|
| `5e38d6d` | 실패한 상품/채팅/거래/관리자 이미지가 broken image 또는 alt 텍스트로 노출될 수 있음 | 공통 `ImageFallback`, 관리자 상품 썸네일 응답과 UI 보강 | 보안 취약점이 아니라 QA 기능 오류 |
| `6ee3585` | placeholder 이미지 URL 처리와 상품 가격 validation이 브라우저 흐름에서 어색함 | placeholder URL 판별, 가격 입력 검증 보강 | 직접 취약점은 아니지만 데이터 품질 위험 완화 |
| `73f5e56` | 상품 등록 카테고리 기본값과 사진 추가 안내가 실제 QA 흐름에 맞지 않음 | 카테고리 미선택 상태와 명시적 선택 안내 적용 | 기능 오류 |
| `e180546` | 상품 생성은 성공했지만 이미지 업로드가 실패하면 사용자가 같은 상품을 다시 만들 수 있음 | 등록 성공과 이미지 업로드 실패를 분리하고, 기존 상품에 이미지만 재시도하는 recovery UI 추가 | 데이터 중복 위험 완화 |

파일 업로드 자체의 보안성은 별도 자동 테스트로 검증했다. `backend/src/modules/products/products-upload.multipart.spec.ts`는 정상 PNG 업로드, UUID 파일명, 위험 확장자, SVG, HTML, 이중확장자, MIME 위장, 타 사용자 업로드 거부를 검증한다. 이 항목은 브라우저 QA 기능 오류와 별개로 파일 업로드 취약점 방어 증거로 사용했다.

## 4. 거래 예약 및 관리자 처리 503 조사

요청 범위에는 “거래 예약 및 관리자 처리 503 재현”, “서버 재시작 또는 최신 코드 반영 문제”가 포함되어 있었다. 현재 저장소에서 다음 범위를 직접 조사했다.

- `docs/dev-log.md`, `docs/report-prep/**`
- 현재 코드와 테스트 전체 grep
- Git commit message와 `git show`
- backend/frontend API 오류 처리 코드

조사 결과, 저장소 안에서는 503을 직접 재현하거나 기록한 문서/커밋/테스트를 찾지 못했다. 따라서 503은 보안 취약점으로 확정하지 않았다.

다만 관련 운영성 근거는 있었다. 거래 구현 기록에는 오래된 `dist/src` 로드 문제를 막기 위해 backend `clean`/`prebuild` script와 seed build exclude를 정리했다는 내용이 있다. 또한 검증 기록에는 DB/Redis 미기동 시 Prisma 연결 실패가 먼저 발생했고, Docker로 의존 서비스를 올린 뒤 재실행했다는 흐름이 남아 있다. 이 근거상 503이 외부 브라우저 QA 세션에서 보였다면, 현재 보고서에서는 “서버 프로세스, 빌드 산출물, DB/Redis 상태, 최신 코드 반영 여부에 의존하는 환경/운영 이슈”로만 다룬다.

현재 코드 기준 자동 검증은 backend/frontend lint/build/test를 통과했다. 따라서 503을 최종 상태로 기록하지 않는다.

## 5. 서버 재시작 또는 최신 코드 반영 문제

현재 backend `package.json`에는 `prebuild`에서 `clean`을 실행해 이전 build 산출물이 남는 문제를 줄이는 구성이 있다. 이는 stale build가 최신 코드와 다른 동작을 만드는 위험을 낮춘다.

운영 관점에서는 여전히 다음 확인이 필요하다.

- 배포 서버에서 build 후 실제 실행 프로세스가 같은 산출물을 사용한다.
- DB/Redis/Toss sandbox 또는 운영 endpoint 상태가 application health check에 반영된다.
- 브라우저 QA 직전 서버 재시작, migration 적용, seed 적용 여부를 체크리스트화한다.
- reverse proxy나 container orchestration 계층에서 발생한 5xx 로그를 application log와 연결한다.

이 항목은 코드 취약점 패치가 아니라 운영 검증 항목으로 분류한다.

## 6. 패치 및 반복 재검증 흐름

| 일시 | 커밋 | 검증 흐름 |
|---|---|---|
| 2026-06-29 13:18:52 +0900 | `5e38d6d` | 브라우저 QA 1차에서 이미지 fallback, 로그인 오류 문구, toast 위치, 관리자 썸네일 문제를 수정 |
| 2026-06-29 17:15:52 +0900 | `6ee3585` | 채팅 optimistic message 중복, 환불 종료 거래 UI, 가격 validation, 알림 이동, placeholder 이미지 처리 보강 |
| 2026-06-29 20:35:32 +0900 | `61547b9` | production UX 흔적 정리 |
| 2026-06-29 22:40:57 +0900 | `73f5e56` | 상품 등록 카테고리, 사진 안내, 거래 note/review copy 등 2차 UX 문제 정리 |
| 2026-07-02 13:37:54 +0900 | `e180546` | 핵심 보안 증거 테스트 5종 추가, 준비 중 UI 제거, 상품 이미지 업로드 recovery 보강 |
| 2026-07-02 14:31:47 +0900 | `981dfc3` | 코드 리뷰 후 결제 provider 기본값, 거래 상세 role/action 판정, 결제 summary 재사용 보강 |

반복 검증에서 중요한 점은 과거 실패를 최종 상태처럼 남기지 않는 것이다. 이미지 표시, 거래 UI, 알림 이동, 상품 등록 recovery 문제는 후속 커밋에서 수정되었고, 현재 보고서에는 “발견 → 패치 → 현재 자동 검증 통과” 흐름으로 기록했다.

## 7. 최종 테스트, lint, build 결과

현재 기준 커밋 `4aed491`에서 직접 실행한 최종 검증 결과다.

| 구분 | 명령 | 결과 |
|---|---|---|
| Backend lint | `cd backend && npm run lint` | 통과 |
| Backend test | `cd backend && npm run test` | 42 files / 292 tests 통과 |
| Backend build | `cd backend && npm run build` | 통과 |
| Frontend lint | `cd frontend && npm run lint` | 통과 |
| Frontend build | `cd frontend && npm run build` | 통과 |
| Prisma schema | `cd backend && npx prisma validate` | 통과, Prisma 7 deprecation warning만 표시 |

정적 보안 검색 결과는 다음과 같다.

| 검색 대상 | 결과 |
|---|---|
| production `$queryRawUnsafe` / `$queryRaw` | spec/test 제외 검색에서 발견되지 않음 |
| spec/test `$queryRawUnsafe` / `$queryRaw` | Prisma mock과 미호출 assertion에서 확인 |
| production `dangerouslySetInnerHTML` / `innerHTML` | spec/test 제외 검색에서 발견되지 않음 |
| spec/test `dangerouslySetInnerHTML` / `innerHTML` | XSS 테스트 assertion에서 확인 |
| 브라우저 `localStorage` / `sessionStorage` access token 저장 | 발견되지 않음. 메모리 저장 주석만 확인 |
| mock payment 문자열 | development/test local payment simulation과 config type에서 존재. production validation은 mock provider를 거부 |
| live 결제 키 패턴 | 발견되지 않음. `.env.example`은 placeholder만 포함 |

## 8. 코드 리뷰에서 발견된 결제/거래 UI 문제와 후속 패치

`981dfc3`는 코드 리뷰 후속 패치다. 주요 내용은 결제와 거래 상세 화면의 운영 위험을 줄이는 쪽이었다.

- 결제 provider 기본값을 Toss로 맞추고, local mock 결제는 개발/테스트용 설정으로 분리했다.
- 거래 상세에서 현재 사용자가 구매자인지 판매자인지 명시적으로 판정해 action 노출 조건을 정리했다.
- payment summary를 재사용해 결제 상태 표시와 action 판단이 서로 어긋날 가능성을 낮췄다.
- 상품/마이페이지의 trust copy를 실제 구현된 신뢰도 의미에 맞게 조정했다.
- 머지 전 리뷰에서 `RESERVED` 상태의 판매자 완료가 결제/에스크로 흐름과 충돌하는 점이 발견되어, 현재 작업 트리에서 서버 완료 조건과 프론트 버튼 노출 조건을 `PAID|SHIPPING` 기반으로 제한했다.

이 패치는 “가격 조작 취약점” 자체를 새로 발견한 것은 아니다. 결제 금액은 이미 서버의 transaction/product 값을 기준으로 계산되고 있었고, 자동 테스트도 이를 검증한다. 다만 결제 전 완료 전이는 별도 P1 상태 전이 문제였으므로 현재 작업 트리 수정과 거래 서비스 테스트로 분리해 기록한다.

## 9. QA 분류 결과

| 분류 | 항목 | 최종 해석 |
|---|---|---|
| 취약점 발견 및 패치 | 정지 사용자 기존 인증 재사용 | `2df58b9`에서 HTTP/WS/roles guard DB status 재조회로 패치 |
| 위협 분석 및 방어 검증 | IDOR/BOLA, Stored XSS, SQL Injection, 파일 업로드, 가격 조작, 관리자 권한, Mass Assignment, Race Condition, CSRF/session, 민감정보, Webhook forgery | 현재 구현이 방어 구조를 갖추고 있으며 자동 테스트와 정적 검색으로 검증 |
| QA 기능 오류 | 이미지 fallback, 상품 등록 recovery, 채팅 중복 표시, 알림 이동, 거래 화면 action, trust copy | 후속 커밋에서 패치, 보안 취약점으로 과장하지 않음 |
| 확인 불가 | 거래 예약/관리자 처리 503 | 저장소 증거 없음. 운영/환경 이슈 가능성만 잔존 위험으로 기록 |

## 10. 남은 QA 보강

자동 테스트와 정적 검색은 통과했지만, 브라우저 기반 e2e 증거는 아직 부분적이다. 운영 배포 전에는 다음 재검증이 필요하다.

- 실제 브라우저 또는 Playwright 기반 상품 등록/이미지 업로드 성공·실패 흐름.
- 실제 Socket.IO client 기반 채팅 room 수신 범위와 비참여자 차단.
- 일반 USER의 `/api/admin/*` HTTP 403과 ADMIN 조치 후 AdminLog 생성 DB assertion.
- Toss sandbox 승인/취소와 실제 webhook endpoint HMAC 검증.
- route별 rate limit 429 검증.
- 5xx 발생 시 application log, reverse proxy log, DB/Redis 상태를 묶은 재현 기록.
