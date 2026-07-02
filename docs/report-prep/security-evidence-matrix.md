# 보안 증거 매트릭스

| 취약점 | 관련 요구사항 | 자동화 증거 | 검증 내용 | 결과 |
|---|---|---|---|---|
| 파일 업로드 취약점 | FR-08, SR-16~SR-21 | `backend/src/modules/products/products-upload.multipart.spec.ts` | Fastify multipart 업로드 경계에서 정상 PNG 성공, UUID 파일명 저장, SVG/PHP/JSP/HTML/이중확장자/위장 MIME 거부, 타 사용자 업로드 거부 | 통과 |
| Race Condition / 중복 판매 | FR-24, FR-29, SR-08, SR-15, SR-26 | `backend/src/modules/transactions/transactions-race.spec.ts` | 같은 상품의 두 `REQUESTED` 거래를 동시에 예약할 때 1건만 `RESERVED` 성공, 나머지는 `ConflictException`, 중복 Transaction/Payment 생성 없음 | 통과 |
| Chat WS Security / BOLA | FR-16~19, SR-07, SR-13, SR-35 | `backend/src/modules/chats/chats-ws-security.spec.ts` | WS handshake 인증 실패 거부, JWT subject 기준 사용자 식별, 비참여자 join/message 거부, 메시지 broadcast 차단 | 통과 |
| Stored XSS / 채팅 | FR-17, SR-13 | `backend/src/modules/chats/chats-ws-security.spec.ts`, `backend/src/modules/chats/chats.service.spec.ts`, 정적 grep | `<img src=x onerror=alert(1)>` payload를 문자열 content로만 저장/전달하고 `html`/`dangerouslySetInnerHTML` 응답 구조 없음 | 통과 |
| 관리자 권한 우회 / AdminLog | FR-42~46, SR-05, SR-09, SR-15, SR-28, SR-36 | `backend/src/modules/admin/admin-security.spec.ts`, `backend/src/modules/admin/admin.controllers.spec.ts`, `backend/src/common/guards/roles.guard.spec.ts` | `/admin/*` controller guard/ADMIN role 고정, USER role 차단, role/status 주입 DTO 거부, 상품 숨김/사용자 제재/신고 처리 시 AdminLog 생성 | 통과 |

## 파일 업로드 상세 증거

- 정상 업로드: `original.png`를 `image/png`과 PNG signature Buffer로 전송하면 `products/<uuid>.png` 형식 URL이 반환된다. 반환 URL과 저장 파일명은 원본명 `original`을 포함하지 않는다.
- 위험 파일 차단: `<script>` 포함 SVG, PHP, JSP, HTML 파일은 확장자 또는 MIME 검증에서 400으로 거부된다.
- 이중확장자 차단: `shell.php.jpg`는 JPEG signature가 있어도 위험 확장자 segment `php` 때문에 400으로 거부된다.
- 위장 파일 차단: 내용이 이미지가 아닌 `fake.png`, MIME과 확장자가 맞지 않는 `fake.jpg`는 400으로 거부된다.
- 접근제어: `product.sellerId !== currentUser.id`인 사용자의 `/products/:id/images` 요청은 403으로 거부된다.
- 저장소 기준: `ProductsService`는 설정값 `security.uploadDir` 하위 `products/` 디렉터리에 UUID 파일명으로 저장한다. 운영 기본값은 웹 루트가 아닌 `/var/app/uploads`이며, 테스트는 임시 디렉터리를 사용하고 종료 후 삭제한다.

## Race Condition 상세 증거

- 동시 예약 시나리오: 같은 `productId`를 가진 두 `REQUESTED` 거래에 대해 동일 판매자가 `reserveTransaction`을 동시에 호출한다.
- 성공 기준: 조건부 `product.updateMany({ status: ON_SALE })`가 먼저 도달한 요청 1건만 `count=1`로 성공하고, 두 번째 요청은 `count=0`으로 `ConflictException`을 반환한다.
- 중복 생성 방어: 예약 API는 기존 거래 상태 전이만 수행하므로 race 실패 경로에서 `transaction.create`와 `payment.create`가 호출되지 않는다.
- 최종 상태: 상품 상태는 `RESERVED` 하나로 수렴하고, 두 거래 중 하나만 `RESERVED`가 된다.

## Chat WS Security 상세 증거

- Handshake 인증: 토큰 없음 또는 잘못된 JWT는 `disconnect(true)`로 거부되며 DB 사용자 조회/room join으로 진행하지 않는다.
- JWT subject 기준 사용자 식별: handshake payload에 `userId`를 주입해도 서버는 JWT `sub`로 DB 사용자 상태를 재조회하고 `socket.data.user`를 설정한다.
- 채팅 BOLA 방어: 비참여자 join은 `ChatsService.assertChatParticipant(chatId, userId)` 실패 후 room join이 발생하지 않는다.
- 메시지 BOLA 방어: 비참여자 message는 `ChatsService.sendMessage(chatId, authenticatedUserId, ...)` 실패 후 broadcast가 발생하지 않는다.
- Mass assignment 방어: message payload의 `senderId`, `userId`, `role` 주입은 WS DTO whitelist/forbidNonWhitelisted로 `WsException` 처리되고 service 호출로 이어지지 않는다.
- XSS 방어: 채팅 content의 HTML/script payload는 실행 구조가 아니라 문자열 `content`로만 전달된다.

## 관리자 액션 로그 상세 증거

- 관리자 controller는 class metadata 기준 `JwtAuthGuard`, `RolesGuard`, `@Roles(Role.ADMIN)`을 요구한다.
- `RolesGuard`는 ACTIVE USER의 관리자 접근을 `ForbiddenException`으로 차단하며, 차단된 요청은 service action/AdminLog 생성으로 진행하지 않는다.
- ADMIN 상품 숨김은 `Product.isHidden=true`, `Product.status=HIDDEN`으로 변경하고 `AdminLog.action=HIDE_PRODUCT`를 기록한다.
- ADMIN 사용자 제재는 `User.status=SUSPENDED`로 변경하고 `AdminLog.action=SUSPEND_USER`를 기록한다.
- 신고 처리는 `Report.status=RESOLVED`와 `adminId/adminNote/reviewedAt` 갱신 후 `AdminLog.action=UPDATE_REPORT_STATUS`를 기록한다.
- 관리자 DTO는 `role`, `status`, `adminId`, `reporterId` 같은 권한/상태 필드 주입을 400으로 거부한다.
