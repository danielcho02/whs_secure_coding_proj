# 파일 업로드 취약점

## 1. 취약점 개요

파일 업로드 취약점은 실행 가능한 파일이나 스크립트 파일을 이미지처럼 올려 서버 파일 시스템 또는 브라우저에서 실행시키는 문제다. 현재 main에서는 업로드 방어가 구현되어 있고, `e180546`에서 실제 multipart 경계 테스트가 추가되었다. 이 항목은 **위협 분석 및 방어 검증**이다.

## 2. OWASP 분류

- OWASP Top 10: A03 Injection, A05 Security Misconfiguration
- 관련 요구사항: SR-16, SR-17, SR-18, SR-19, SR-20, SR-21

## 3. 위협 및 공격 시나리오

- `shell.php.jpg` 같은 이중 확장자 파일을 올린다.
- SVG/HTML에 script를 넣어 브라우저 실행을 노린다.
- MIME만 이미지로 속이고 실제 내용은 텍스트 또는 실행 파일로 보낸다.
- 원본 파일명을 경로로 사용하게 만들어 path traversal 또는 파일 덮어쓰기를 시도한다.
- 상품 작성자가 아닌 사용자가 타인 상품에 이미지를 업로드한다.

## 4. 영향받는 기능/API

- `POST /api/products/:id/images`
- 프론트 상품 등록/수정 이미지 업로드 UI
- 정적 업로드 제공 route

## 5. 기존 구현 분석

상품 이미지 업로드는 작성자 검증 후 파일 수, 크기, 확장자, MIME, 매직바이트를 검사한다. 원본 파일명은 저장 파일명으로 쓰지 않고 UUID 파일명을 생성한다.

## 6. 패치 또는 방어 구현

- 요청당 최대 파일 수 제한
- 환경설정 기반 파일 크기 제한
- 허용 MIME: JPEG, PNG, WebP
- 위험 확장자 segment 차단: HTML, JS, PHP, JSP, SVG 등
- 파일 시그니처 검사: JPEG/PNG/WebP magic byte
- MIME과 시그니처 대조
- 확장자와 시그니처 대조
- UUID 파일명 저장
- 상품 작성자만 업로드 가능
- 운영 upload dir은 production에서 명시/쓰기 가능해야 시작

## 7. 핵심 코드와 파일 경로

- `backend/src/modules/products/products.controller.ts`: multipart 파일 추출
- `backend/src/modules/products/products.service.ts`: `validateImage`, `getSafeExtension`, `detectImageType`
- `backend/src/config/configuration.ts`: upload dir resolution
- `backend/src/upload-routes.ts`: 업로드 정적 route
- `frontend/src/pages/ProductFormPage.tsx`: 업로드 실패 recovery UI

핵심 코드:

```ts
const filename = `${randomUUID()}.${validated.image.extension}`;
const relativeUrl = `/uploads/products/${filename}`;
```

```ts
if (segments.some((segment) => DANGEROUS_EXTENSIONS.has(segment))) {
  throw new BadRequestException('Executable file extensions are not allowed');
}
```

## 8. 자동 테스트

- `backend/src/modules/products/products-upload.multipart.spec.ts`
  - 정상 PNG 업로드 성공
  - URL과 실제 파일명이 UUID 패턴인지 확인
  - SVG, PHP, JSP, HTML 거부
  - `shell.php.jpg` 거부
  - plain text 위장 이미지 거부
  - MIME/확장자 mismatch 거부
  - 비작성자 업로드 403
- `backend/src/config/configuration.spec.ts`: production upload dir 필수/쓰기 가능성 검증

## 9. 브라우저 QA

브라우저 QA에서 이미지 fallback과 업로드 실패 UX 문제가 발견되었다.

- `5e38d6d`: broken image 대신 공통 fallback UI 적용
- `6ee3585`: placeholder 이미지 URL 판별
- `e180546`: 상품은 등록됐지만 이미지 업로드만 실패한 경우 중복 상품 생성을 막고, 기존 상품에 이미지만 재시도하는 recovery UI 추가

이는 서버 업로드 검증 우회 취약점이 아니라 UI/데이터 중복 위험 완화로 분류했다.

## 10. Git 패치 기록

- `f29b135`: 상품 업로드 검증 구현
- `5e38d6d`: 이미지 fallback QA 수정
- `6ee3585`: placeholder 이미지 처리
- `e180546`: multipart security test와 upload recovery UI 추가
- `981dfc3`: 관련 거래/결제 UI 리뷰 후속과 함께 최종 재검증

## 11. 패치 전후 비교

| 구분 | 위험한 방식 | 현재 방식 |
|---|---|---|
| 파일명 | 원본명 저장 | UUID 재생성 |
| 파일 종류 | 확장자만 확인 | 확장자 + MIME + 매직바이트 |
| 이중 확장자 | 마지막 확장자만 신뢰 | 모든 segment에서 위험 확장자 차단 |
| 접근제어 | 상품 ID만 있으면 업로드 | 작성자 검증 |
| 업로드 실패 UX | 재등록 유도 가능 | 기존 상품 이미지 재시도 |

## 12. 잔존 위험

- 바이러스/악성 이미지 스캐닝은 구현되어 있지 않다.
- 이미지 리사이징/메타데이터 제거는 구현되어 있지 않다.
- 상품 숨김/삭제는 soft delete 또는 `HIDDEN` 상태 변경이며, 현재 범위에서는 `ProductImage` 레코드와 실제 업로드 파일을 즉시 제거하지 않는다.
- 기존 `/uploads/products/:filename` URL을 알고 있는 사용자는 파일명이 UUID 형식이면 상품 숨김 상태와 별개로 이미지를 계속 조회할 수 있다.
- 운영 환경에서는 파일 삭제 정책, 보존 기간, 정적 파일 제공 시 visibility 검사, 비동기 정리 작업이 필요하다.
- 운영 파일 저장소 권한, CDN content-type, 다운로드 헤더는 배포 환경에서 재검증해야 한다.

## 13. 향후 개선

- 업로드 후 이미지 처리 파이프라인에서 EXIF 제거와 리사이징을 추가한다.
- object storage로 분리하고 bucket policy를 read-only/static으로 제한한다.
- 악성 파일 스캐닝과 업로드 감사 로그를 추가한다.
- 상품 숨김/삭제 이벤트와 연결된 이미지 정리 job 또는 visibility-aware signed URL 제공 방식을 도입한다.
