# SQL Injection

## 1. 취약점 개요

SQL Injection은 검색어, 필터, 관리자 조회 조건 같은 사용자 입력이 SQL 문자열로 직접 연결될 때 발생한다. 현재 main의 production 코드에서는 `$queryRawUnsafe` 또는 `$queryRaw` 사용을 찾지 못했다. 이 항목은 **위협 분석 및 방어 검증**이다.

## 2. OWASP 분류

- OWASP Top 10: A03 Injection
- 관련 요구사항: SR-11, SR-12

## 3. 위협 및 공격 시나리오

- 검색어에 SQL 조건을 삽입해 숨김 상품이나 타인 데이터를 노출시킨다.
- 관리자 상품/사용자 검색 `q`에 SQL fragment를 넣어 쿼리를 변조한다.
- 신고/알림 목록 pagination 값을 조작해 비정상 쿼리를 유도한다.

## 4. 영향받는 기능/API

- `GET /api/products/search`
- `GET /api/products`
- `GET /api/admin/products`
- `GET /api/admin/users`
- `GET /api/reports/me`
- `GET /api/notifications`

## 5. 기존 구현 분석

상품 검색은 Prisma `findMany`의 `where` 조건만 사용한다. 문자열 보간으로 SQL을 만드는 코드가 없다.

```ts
where.OR = [
  { title: { contains: searchTerm, mode: 'insensitive' } },
  { description: { contains: searchTerm, mode: 'insensitive' } },
  { category: { contains: searchTerm, mode: 'insensitive' } },
];
```

관리자 검색도 Prisma 조건 객체를 사용한다.

## 6. 패치 또는 방어 구현

- production DB 접근은 Prisma ORM 경로로 제한한다.
- DTO에서 pagination, 가격 범위, status enum 값을 검증한다.
- 테스트 mock에서는 `$queryRawUnsafe`가 존재하더라도 호출되지 않음을 assertion으로 검증한다.

## 7. 핵심 코드와 파일 경로

- `backend/src/modules/products/products.service.ts`: `buildProductWhere`, `searchProducts`
- `backend/src/modules/admin/admin.service.ts`: `buildProductWhere`, 사용자 검색 조건
- `backend/src/modules/notifications/notifications.service.ts`: 본인 알림 where 조건
- `backend/src/modules/reports/reports.service.ts`: 내 신고 목록 where 조건

## 8. 자동 테스트

- `backend/src/modules/products/products.service.spec.ts`: SQLi payload가 raw query 호출로 이어지지 않음
- `backend/src/modules/transactions/transactions.service.spec.ts`: raw unsafe 미호출 검증
- `backend/src/modules/reports/reports.service.spec.ts`: 내 신고 목록 raw unsafe 미호출 검증
- `backend/src/modules/notifications/notifications.service.spec.ts`: raw unsafe 미호출 검증
- 정적 검색: production 코드에서 `$queryRawUnsafe` / `$queryRaw` 미발견

## 9. 브라우저 QA

검색창/목록 필터의 SQLi 실행 문제는 QA 기록에서 발견되지 않았다. 프론트 QA는 주로 이미지 fallback, 가격 입력 validation, 알림 이동 같은 기능 오류 중심이었다.

## 10. Git 패치 기록

- `f29b135`: 상품 검색을 Prisma 조건으로 구현
- `4fa47c2`: 관리자 목록/신고/차단 모듈을 Prisma 조건으로 구현
- `8a1982f`: 알림 목록을 currentUser 조건으로 구현
- `e180546`: 정적 보안 증거와 smoke test 보강

## 11. 패치 전후 비교

| 구분 | 위험한 방식 | 현재 방식 |
|---|---|---|
| 상품 검색 | 검색어를 SQL 문자열에 직접 삽입 | Prisma `contains` 조건 |
| 관리자 검색 | q를 raw SQL에 연결 | Prisma where 객체 |
| pagination | 문자열 값 직접 사용 | DTO transform + min/max 검증 |

## 12. 잔존 위험

- 향후 성능 최적화 목적으로 raw SQL을 추가할 경우 보안 리뷰가 필요하다.
- DB 로그/슬로우쿼리 분석은 자동 테스트 범위 밖이다.
- 검색어 길이와 색인 전략은 DoS 관점에서 운영 튜닝이 필요하다.

## 13. 향후 개선

- CI에서 production 코드의 `$queryRawUnsafe` 사용을 실패 처리하는 정적 규칙을 추가한다.
- 검색 API에 길이 제한과 요청량 제한을 명시적으로 테스트한다.
- 관리자 q 필터의 특수문자 payload 테스트를 e2e로 추가한다.
