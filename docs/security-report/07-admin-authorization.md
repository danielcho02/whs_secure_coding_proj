# 관리자 권한 우회

## 1. 취약점 개요

관리자 권한 우회는 일반 사용자가 `/api/admin/*`를 직접 호출하거나, 정지된 관리자가 기존 인증으로 관리자 작업을 계속 수행하는 문제다. 일반 USER의 관리자 접근은 처음부터 `JwtAuthGuard + RolesGuard + @Roles(ADMIN)` 구조로 방어되었다. 그러나 2026-06-28에는 `RolesGuard`가 role만 보고 status를 보지 않는 위험이 실제로 발견되어 패치되었다.

이 문서는 **취약점 발견 및 패치**와 **위협 분석 및 방어 검증**을 함께 다룬다.

## 2. OWASP 분류

- OWASP Top 10: A01 Broken Access Control
- OWASP API Security Top 10: API5 Broken Function Level Authorization
- 관련 요구사항: SR-05, SR-09, SR-28, SR-36, SR-39

## 3. 위협 및 공격 시나리오

- 일반 사용자가 관리자 API URL을 직접 호출한다.
- body/query에 `role=ADMIN`을 넣어 관리자처럼 처리되기를 시도한다.
- 정지된 ADMIN이 기존 인증이 만료되기 전에 사용자 제재, 상품 숨김, 신고 처리 API를 호출한다.
- 관리자 로그를 조작하거나 삭제하려 한다.

## 4. 영향받는 기능/API

- `GET /api/admin/reports`
- `GET /api/admin/reports/:id`
- `PATCH /api/admin/reports/:id/status`
- `GET /api/admin/products`
- `PATCH /api/admin/products/:id/hide|restore`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/suspend|restore`
- `GET /api/admin/logs`

## 5. 기존 구현 분석

관리자 컨트롤러에는 class level guard와 role metadata가 적용되어 있다.

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/products')
```

실제 패치 전 위험은 role 검증만으로 정지된 ADMIN을 구분하지 못할 수 있다는 점이었다. `2df58b9`에서 `RolesGuard`가 `User.status=ACTIVE`도 요구하도록 수정되었다.

## 6. 패치 또는 방어 구현

- `JwtAuthGuard`는 JWT payload를 식별 힌트로만 사용하고 DB에서 `id/email/role/status`를 재조회한다.
- `RolesGuard`는 role이 맞아도 status가 ACTIVE가 아니면 403을 반환한다.
- 정상 경로의 관리자 상태 변경은 `AdminLog` 생성 테스트로 검증했다.
- 자기 자신 정지와 마지막 ACTIVE 관리자 정지를 거부한다.
- 상품 restore는 활성/완료 거래가 있으면 재판매 위험 때문에 409로 거부한다.
- 관리자 DTO는 `role`, `status`, `adminId`, `reporterId` 주입을 거부한다.

## 7. 핵심 코드와 파일 경로

- `backend/src/common/guards/jwt-auth.guard.ts`
- `backend/src/common/guards/roles.guard.ts`
- `backend/src/modules/admin/admin-*.controller.ts`
- `backend/src/modules/admin/admin.service.ts`
- `backend/src/modules/admin/admin-security.spec.ts`

핵심 코드:

```ts
if (userStatus !== UserStatus.ACTIVE) {
  throw new ForbiddenException('Active user status is required');
}
```

## 8. 자동 테스트

- `backend/src/modules/admin/admin-security.spec.ts`
  - 모든 admin controller guard/role metadata 확인
  - ACTIVE USER 접근 차단
  - 상품 숨김, 사용자 제재, 신고 처리 시 AdminLog 생성
  - admin DTO 권한 필드 주입 거부
- `backend/src/common/guards/roles.guard.spec.ts`
  - SUSPENDED ADMIN 403
  - ACTIVE ADMIN 통과
  - ACTIVE USER 403

## 9. 브라우저 QA

`5e38d6d`에서 관리자 상품 목록에 썸네일이 없어 QA 화면에서 상품 식별이 어렵다는 문제가 수정되었다. 이는 권한 우회 취약점은 아니며, 관리자 조치 화면의 운영성 문제다.

관리자 HTTP e2e와 스크린샷 증거는 report-prep에서 부분 검증으로 남아 있다.

## 10. Git 패치 기록

- `4fa47c2`: 관리자 API, AdminLog, moderation 구현
- `2df58b9`: 정지 관리자 기존 인증 재사용 위험 패치
- `5e38d6d`: 관리자 상품 썸네일 QA 수정
- `e180546`: admin-security 테스트 추가

## 11. 패치 전후 비교

| 구분 | 이전 위험 | 현재 구현 |
|---|---|---|
| 일반 USER 접근 | URL 직접 호출 가능성 | RolesGuard에서 403 |
| 정지 ADMIN | role만 맞으면 관리자 API 접근 가능성 | role + ACTIVE status 요구 |
| 관리자 조치 부인 | 로그 누락 가능성 | 정상 경로에서 AdminLog 생성 |
| 상품 restore | 숨김 상품 재노출로 중복 판매 위험 | 활성/완료 거래 있으면 409 |

## 12. 잔존 위험

- 관리자 HTTP e2e는 unit/reflection 중심보다 약하다.
- 일부 관리자 조치 경로는 대상 상태 update 후 별도 `writeAdminLog`를 호출한다. 같은 Prisma transaction으로 묶이지 않은 경우 로그 insert 실패 시 관리자 조치는 반영되고 로그 없이 5xx가 반환될 수 있다.
- 관리자 로그는 append-only API 정책이지만 완전한 부인 방지 증거는 아니다. DB 레벨 해시 체인이나 WORM 저장소도 없다.
- 관리자 MFA, IP allowlist, 세션 재인증은 구현되어 있지 않다.

## 13. 향후 개선

- 관리자 API를 실제 HTTP e2e로 검증한다.
- 관리자 상태 변경과 AdminLog insert를 동일 Prisma transaction으로 묶고, 로그 실패 시 전체 조치를 rollback하는 정책을 적용한다.
- 관리자 조치 로그에 해시 체인을 붙여 위변조 탐지력을 높인다.
- 운영 관리자 계정에는 MFA와 최소 권한 역할 분리를 추가한다.
