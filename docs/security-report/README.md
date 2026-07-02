# 시큐어 코딩 보안 패치 보고서

이 디렉터리는 `whs_secure_coding_proj` 최종 제출용 보안 패치 보고서다. 현재 작성 기준은 `docs/security-patch-report` 브랜치이며, 조사 시점의 `main`도 같은 커밋 `4aed491`을 가리키고 있었다.

## 문서 구성

- `00-project-overview.md`: 프로젝트 범위, 신뢰 경계, 조사 기준
- `01-security-patch-timeline.md`: Git 커밋 타임라인과 보안 작업 표
- `02-idor-bola.md` ~ `12-webhook-forgery.md`: 취약점별 분석, 방어 구현, 테스트 근거
- `13-testing-and-qa.md`: 자동 테스트와 브라우저 QA 흐름
- `14-residual-risks.md`: 완료/부분 검증/외부 의존/운영 전 작업
- `evidence/`: 테스트 결과, 브라우저 QA 요약, 커밋별 증거

## 작성 기준

- 실제 코드, 테스트, 문서, Git 이력에서 확인한 내용만 적었다.
- 실제 취약 코드가 확인된 항목과, 처음부터 안전하게 구현되어 방어를 검증한 항목을 구분했다.
- 비밀번호, 토큰 값, 쿠키 값, 개인 연락처, 실제 결제 키는 기록하지 않았다.
- 과거 QA 실패는 최종 상태처럼 쓰지 않고, 패치 및 재검증 결과와 분리했다.
