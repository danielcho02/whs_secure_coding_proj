# Stored XSS

## 1. 취약점 개요

Stored XSS는 상품 설명이나 채팅 메시지에 스크립트성 문자열을 저장한 뒤 다른 사용자의 브라우저에서 실행시키는 문제다. 현재 main에서 `dangerouslySetInnerHTML` 또는 `innerHTML`을 production 코드에서 사용하는 흔적은 없었다. 이 항목은 **위협 분석 및 방어 검증**이다.

## 2. OWASP 분류

- OWASP Top 10: A03 Injection
- 관련 요구사항: SR-13, SR-31, SR-39

## 3. 위협 및 공격 시나리오

- 판매자가 상품 설명에 이벤트 핸들러가 포함된 HTML을 저장한다.
- 공격자가 채팅 메시지에 script payload를 전송한다.
- 프론트엔드가 해당 문자열을 HTML로 렌더링하면 세션 탈취, 피싱 UI 삽입, 관리자 화면 조작으로 이어질 수 있다.

## 4. 영향받는 기능/API

- 상품 등록/수정: `POST /api/products`, `PATCH /api/products/:id`
- 상품 상세/목록: `GET /api/products/:id`, `GET /api/products`
- 채팅 메시지: `POST /api/chats/:id/messages`, WebSocket `message`
- 신고/관리자 상세의 채팅 메시지 summary

## 5. 기존 구현 분석

백엔드는 상품 설명과 채팅 메시지를 문자열로 저장하고 반환한다. 프론트 정적 검색에서 production 코드의 HTML 직접 삽입 sink는 발견되지 않았다.

정적 검색 결과:

- `dangerouslySetInnerHTML`: 테스트 assertion에서만 발견
- `innerHTML`: production 코드에서 미발견
- 토큰 영구 저장소: access token을 메모리에 둔다는 주석 외 미발견

## 6. 패치 또는 방어 구현

- React 기본 텍스트 바인딩을 사용한다.
- 채팅 WS 테스트는 XSS payload가 `content` 문자열로만 전달되고 `html` 또는 `dangerouslySetInnerHTML` 필드가 없음을 검증한다.
- access token은 브라우저 영구 저장소에 두지 않아 XSS 발생 시 피해 범위를 줄인다.

## 7. 핵심 코드와 파일 경로

- `backend/src/modules/chats/chats.service.ts`: 메시지 `content` 저장
- `backend/src/modules/chats/chats-ws-security.spec.ts`: XSS payload 문자열 처리 검증
- `frontend/src/api/client.ts`: access token 메모리 보관
- `frontend/src/pages/ProductDetailPage.tsx`, `ChatsPage.tsx`: React 렌더링 경로

핵심 테스트 예시:

```ts
expect(result.data.content).toBe(xssPayload);
expect(result.data).not.toHaveProperty('html');
```

## 8. 자동 테스트

- `backend/src/modules/chats/chats-ws-security.spec.ts`: WS message XSS payload 문자열 처리
- `backend/src/modules/chats/chats.service.spec.ts`: 메시지 응답에 HTML 렌더링 전용 필드 없음
- 정적 검색: production `dangerouslySetInnerHTML` / `innerHTML` 미발견

## 9. 브라우저 QA

브라우저 QA에서는 XSS 실행 자체가 발견되었다는 기록은 없다. 대신 placeholder image fallback과 broken image 노출 문제는 `5e38d6d`, `6ee3585`에서 UI 품질 문제로 수정되었다. 이는 XSS 취약점이 아니라 렌더링 실패 UX 문제로 분리했다.

## 10. Git 패치 기록

- `21b20b9`: 채팅 메시지 구현 및 XSS 방어 관점 테스트
- `6ee3585`: placeholder image fallback 보강
- `e180546`: WS XSS 문자열 처리 보안 테스트 추가

## 11. 패치 전후 비교

| 구분 | 위험한 방식 | 현재 방식 |
|---|---|---|
| 채팅 메시지 | HTML로 해석해 삽입 | 문자열 `content`로 저장/전달 |
| 상품 설명 | 직접 HTML sink 사용 | React 텍스트 렌더링 |
| 토큰 저장 | 브라우저 영구 저장소 | 메모리 보관 |

## 12. 잔존 위험

- CSP 헤더의 구체 정책은 Helmet 기본 적용 이상으로 세밀하게 검증하지 않았다.
- 향후 Markdown/HTML 상품 설명 기능을 추가하면 DOMPurify 같은 sanitizer와 CSP 테스트가 필요하다.
- 업로드된 이미지의 외부 SVG 렌더링 같은 신규 기능이 들어오면 XSS 위협 모델을 다시 봐야 한다.

## 13. 향후 개선

- Playwright로 payload가 화면에서 텍스트로만 보이고 실행되지 않는지 브라우저 테스트를 추가한다.
- CSP report-only부터 적용해 inline script 차단 정책을 검증한다.
- 관리자 신고 상세에서 채팅 메시지 summary 렌더링도 브라우저 스냅샷으로 확인한다.
