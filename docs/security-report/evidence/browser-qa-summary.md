# 브라우저 QA 요약

## 1. 확인한 QA 근거

브라우저 QA 관련 근거는 `docs/dev-log.md`, `docs/report-prep/security-test-plan.md`, `git show` 결과에서 확인했다. QA 문제는 보안 취약점과 구분했다.

## 2. 발견 및 패치된 기능 문제

| 일시/커밋 | 발견된 문제 | 패치 내용 | 분류 |
|---|---|---|---|
| 2026-06-29 `5e38d6d` | 실패한 상품/채팅/거래/관리자 이미지가 broken image 또는 alt 텍스트로 노출될 수 있음 | 공통 `ImageFallback`, 관리자 상품 썸네일 응답과 UI 보강 | QA 기능 오류 |
| 2026-06-29 `5e38d6d` | toast 위치, 한국어 줄바꿈, 로그인 실패 안내가 거칠게 보임 | safe-area 간격, 로그인 오류 메시지 정리 | QA 기능 오류 |
| 2026-06-29 `6ee3585` | 채팅 optimistic message 중복, REFUNDED terminal 거래 UI, 가격 validation, 알림 target navigation, placeholder image fallback 문제 | 메시지 reconcile, terminal banner/action 제한, 가격 입력 검증, 알림 클릭 이동, placeholder URL 판별 | QA 기능 오류 |
| 2026-06-29 `73f5e56` | 상품 등록 카테고리 기본값과 사진 추가 안내가 실제 QA 흐름에 맞지 않음 | 카테고리 미선택 상태와 명시적 선택 안내, 문구 조정 | QA 기능 오류 |
| 2026-07-02 `e180546` | 상품 등록 후 이미지 업로드 실패 시 사용자가 중복 상품을 만들 위험 | 등록 성공/이미지 업로드 실패를 분리하고 기존 상품에 이미지만 재시도하는 recovery UI 추가 | QA 기능 오류, 데이터 중복 위험 완화 |
| 2026-07-02 `e180546` | 준비 중 화면, 준비 중 소셜 로그인, 비밀번호 재설정 placeholder가 실제 서비스처럼 보이지 않음 | 미연결 페이지와 준비 중 버튼 제거 | QA 기능 오류 |
| 2026-07-02 `981dfc3` | 결제 provider 기본값과 거래 상세 action/role 판정이 리뷰에서 지적됨 | provider 기본값을 Toss로 변경, 거래 당사자 role을 명시적으로 판정, payment summary 재사용 | QA 기능 오류, 운영 설정 위험 완화 |

## 3. 503 재현 기록 조사

요청에는 “거래 예약 및 관리자 처리 503 재현”, “서버 재시작 또는 최신 코드 반영 문제”가 포함되어 있었다. 그러나 현재 저장소의 문서, 커밋 메시지, `git show`, 전체 grep에서는 `503`이라는 직접 기록을 찾지 못했다.

관련해서 확인된 사실은 다음과 같다.

- `docs/dev-log.md`에는 거래 구현 당시 stale `dist/src` 로드 문제를 막기 위해 backend `clean`/`prebuild` script와 seed build exclude를 정리했다는 기록이 있다.
- 여러 검증 기록에서 `npm run start`는 장기 실행을 피하기 위해 timeout으로 종료했고, DB 미기동 시 Prisma 연결 실패가 먼저 확인된 뒤 Docker로 DB/Redis를 올려 재실행했다는 기록이 있다.
- 현재 코드 기준 자동 검증은 backend/frontend lint/build/test가 통과한다.

따라서 503은 보안 취약점으로 단정하지 않았고, “외부 브라우저 QA 세션에서 발생했을 수 있으나 저장소 증거로는 직접 확인되지 않은 기능/환경 이슈”로만 기록했다.

## 4. 최종 재검증

현재 코드 기준으로 다음 재검증을 완료했다.

- Backend lint/test/build 통과
- Frontend lint/build 통과
- Prisma schema validate 통과
- production 코드에서 unsafe SQL sink와 HTML injection sink 미발견
- access token 영구 저장소 사용 미발견
