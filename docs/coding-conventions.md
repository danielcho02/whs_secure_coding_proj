# 코딩 컨벤션 (Coding Conventions)

## 1. 언어/스타일

- **TypeScript strict mode** (`"strict": true`). `any` 금지, 불가피하면 `unknown` + 타입가드.
- 포매터: **Prettier**, 린터: **ESLint** (`@typescript-eslint/recommended`).
- 들여쓰기 2칸, 세미콜론 사용, 작은따옴표.
- 커밋 전 `lint` + `test` 통과 필수.

## 2. 네이밍

| 대상 | 규칙 | 예 |
|------|------|----|
| 파일 | kebab-case | `products.service.ts` |
| 클래스 | PascalCase | `ProductsService` |
| 변수/함수 | camelCase | `getProductById` |
| 상수 | UPPER_SNAKE | `MAX_UPLOAD_SIZE` |
| DTO | `*.dto.ts` | `create-product.dto.ts` |
| 환경변수 | UPPER_SNAKE | `JWT_ACCESS_SECRET` |

## 3. NestJS 모듈 규칙

- 한 도메인 = 한 모듈(`module / controller / service / dto`).
- 컨트롤러는 라우팅·검증·권한만, 비즈니스 로직은 서비스.
- DB 접근은 서비스 → Prisma. 컨트롤러에서 Prisma 직접 호출 금지.
- 모든 입력은 **DTO + class-validator**로 검증. 검증 없는 `@Body()` raw 사용 금지.

```ts
export class CreateProductDto {
  @IsString() @Length(1, 100) title: string;
  @IsInt() @Min(0) @Max(100_000_000) price: number;   // SR-14
  @IsString() @Length(1, 5000) description: string;
  @IsString() category: string;
  // sellerId, status는 받지 않음 — 서버가 결정 (SR-15)
}
```

## 4. 보안 코딩 규칙 (강제)

1. 클라이언트가 보낸 `userId`/`role`/`price`/`status`는 **신뢰하지 않는다.** 토큰의 `sub`와 DB 값으로만 판단.
2. 객체 조회·수정·삭제 시 **소유자/참여자 검증을 서비스 진입 시 수행**(BOLA).
3. SQL은 항상 Prisma 파라미터 바인딩. `$queryRawUnsafe`는 보안 시연용 외 금지.
4. 출력은 React 텍스트 바인딩(자동 escape). HTML 필요 시 DOMPurify.
5. 비밀번호는 bcrypt(cost ≥ 10) 또는 Argon2.
6. 로그에 비밀번호·토큰·계좌·전화 저장 금지.
7. 응답 직렬화 시 `@Exclude()`로 민감 필드 제거.
8. 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
9. 시크릿은 `.env`로 분리, 절대 커밋 금지. `config` 모듈에서 스키마 검증.
10. 에러는 전역 필터로 처리, 내부 스택/쿼리 미노출.

## 5. 에러/응답 포맷

```ts
// 성공
{ "success": true, "data": { ... } }
// 실패
{ "success": false, "error": { "code": "FORBIDDEN", "message": "권한이 없습니다." } }
```
- HTTP 상태코드 정확히 사용(400/401/403/404/409/429/500).
- 권한 없음은 404 또는 403로 일관(존재 여부 노출 최소화는 케이스별 판단).

## 6. 테스트 (NFR-08)

- 단위 테스트: 서비스 로직(Jest).
- 통합 테스트: 컨트롤러 + DB(테스트 컨테이너).
- **보안 테스트**: `security-spec.md` §4 체크리스트를 e2e로 자동화.
- 커버리지 목표: 핵심 도메인(auth/products/chats/transactions/payments) 70%+.

## 7. Git 컨벤션

- 브랜치: `feat/`, `fix/`, `security/`, `docs/`, `test/`.
- 커밋(Conventional Commits):
  ```
  feat(products): 상품 등록 API
  fix(chats): 채팅방 IDOR 소유자 검증 추가
  security(payments): 결제 금액 서버 재계산
  ```
- PR에는 관련 FR/SR ID와 테스트 결과 기재.

## 8. 디렉터리 import 규칙

- `common/`의 가드·파이프·데코레이터는 전역 또는 모듈에서 명시적 주입.
- 순환 의존 금지. 도메인 간 직접 참조 대신 명확한 서비스 경계.
