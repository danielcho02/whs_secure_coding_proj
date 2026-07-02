# CSRF 및 세션 보안

## 1. 취약점 개요

세션 보안은 인증 토큰 저장, refresh 회전, 로그아웃 무효화, 정지 사용자 차단을 포함한다. 이 프로젝트에서는 refresh 계열을 HttpOnly/SameSite cookie와 Redis jti로 관리하고, access 계열은 브라우저 메모리에 둔다.

실제 패치 항목은 `2df58b9`의 “정지 사용자 기존 인증 재사용” 문제다. 반면 CSRF 전용 토큰은 구현 증거가 없으므로 잔존 위험으로 분리한다.

## 2. OWASP 분류

- OWASP Top 10: A01 Broken Access Control, A07 Identification and Authentication Failures
- 관련 요구사항: SR-02, SR-03, SR-04, SR-05, SR-34, SR-36

## 3. 위협 및 공격 시나리오

- 탈취되거나 오래된 인증이 정지 이후에도 API를 호출한다.
- refresh 토큰 재사용으로 세션 탈취를 시도한다.
- 악성 사이트가 사용자의 브라우저를 이용해 쿠키 기반 상태 변경 요청을 유도한다.
- XSS로 브라우저 영구 저장소의 token을 훔친다.

## 4. 영향받는 기능/API

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- 모든 `JwtAuthGuard` 보호 API
- WebSocket `/ws`
- `/api/admin/*`

## 5. 기존 구현 분석

`AuthController`는 refresh 값을 HttpOnly/SameSite strict cookie로 설정하고, production에서 secure 옵션을 켠다. `AuthService`는 refresh jti를 Redis에 저장하고 refresh마다 회전한다.

패치 전 위험은 `JwtAuthGuard`와 WebSocket handshake가 DB의 최신 사용자 status를 재확인하지 않는 것이었다. 즉 정지된 사용자가 기존 인증 만료 전까지 일부 기능을 쓸 수 있었다.

## 6. 패치 또는 방어 구현

- `JwtAuthGuard`: JWT `sub`로 DB 사용자 상태 재조회
- `RolesGuard`: ADMIN role뿐 아니라 ACTIVE status 요구
- `ChatsGateway`: handshake에서 DB status 재조회 후 inactive user disconnect
- `AuthService.refresh`: user status가 ACTIVE가 아니면 전체 refresh session 제거
- refresh 재사용 탐지: whitelist에 없는 jti면 전체 refresh session 제거
- 프론트 access token: 메모리 변수에만 저장

## 7. 핵심 코드와 파일 경로

- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/common/guards/jwt-auth.guard.ts`
- `backend/src/common/guards/roles.guard.ts`
- `backend/src/modules/chats/chats.gateway.ts`
- `frontend/src/api/client.ts`

핵심 코드:

```ts
if (!user || user.status !== UserStatus.ACTIVE) {
  throw new UnauthorizedException('Authentication is required');
}
```

```ts
reply.setCookie(name, value, {
  httpOnly: true,
  secure: this.nodeEnv === 'production',
  sameSite: 'strict',
  path,
});
```

## 8. 자동 테스트

- `backend/src/modules/auth/auth.service.spec.ts`: bcrypt, 로그인 실패 잠금, refresh 회전, refresh 재사용 무효화, logout
- `backend/src/modules/auth/auth.controller.spec.ts`: HttpOnly/SameSite cookie, public response에 refresh 미포함
- `backend/src/common/guards/jwt-auth.guard.spec.ts`: DB status 재조회, suspended user 차단
- `backend/src/common/guards/roles.guard.spec.ts`: suspended admin 403
- `backend/src/modules/chats/chats-ws-security.spec.ts`: WS invalid/missing token 차단, JWT subject 기준 식별

## 9. 브라우저 QA

프론트 정적 검색에서 `localStorage`/`sessionStorage` token 저장은 발견되지 않았다. `e180546`에서는 refresh 실패 시 세션 listener가 null 처리되는 흐름도 다듬었다.

CSRF 전용 브라우저 재현 테스트는 확인되지 않았다.

## 10. Git 패치 기록

- `0296390`: secure refresh session flow 구현
- `2df58b9`: inactive HTTP/WS/admin 인증 재사용 차단 패치
- `e180546`: API client refresh 오류 처리와 보안 smoke 보강

## 11. 패치 전후 비교

| 구분 | 이전 위험 | 현재 구현 |
|---|---|---|
| 정지 사용자 HTTP | 기존 인증 만료 전 접근 가능성 | 매 요청 DB status 재조회 |
| 정지 관리자 | role만 맞으면 접근 가능성 | role + ACTIVE status 요구 |
| 정지 사용자 WS | 기존 연결/토큰으로 join 가능성 | handshake DB status 확인 |
| refresh 재사용 | 재사용 시 감지 약함 | whitelist jti 확인, 전체 세션 제거 |
| XSS token 탈취 | 영구 저장소 저장 시 위험 큼 | access token 메모리 보관 |

## 12. 잔존 위험

- CSRF token 자체는 구현되어 있지 않다.
- refresh cookie는 SameSite strict와 path 제한이 있지만, 상태 변경 API 대부분은 Bearer 인증을 요구한다는 구조적 방어에 의존한다.
- 운영 배포에서 HTTPS, secure cookie, CORS origin, proxy header 설정이 정확해야 한다.

## 13. 향후 개선

- 상태 변경 API에 double-submit 또는 synchronizer CSRF token을 추가한다.
- refresh endpoint에 origin/referrer 검증과 route-level rate limit을 추가한다.
- 관리자 계정에는 짧은 세션 만료와 재인증을 적용한다.
