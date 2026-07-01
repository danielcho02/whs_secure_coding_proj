# 보안 취약점 및 패치 정리 초안

## 1. 요약

- 이번 프로젝트에서 중점적으로 다룬 취약점은 IDOR/BOLA, Stored XSS, SQL Injection, 파일 업로드 취약점, 결제 금액 조작, 관리자 권한 우회 6종이다.
- 실제 코드에서 강한 패치 근거가 확인된 항목은 IDOR/BOLA, SQL Injection, 결제 금액 조작, 관리자 권한 우회, Mass Assignment, 민감정보 노출, Webhook Forgery이다.
- 보고서 작성 시 핵심으로 보여줄 내용은 "클라이언트 입력 불신", "서비스 레벨 소유자/참여자 검증", "Prisma 기반 검색", "서버 기준 결제 금액 산정", "관리자 권한 DB 재확인", "응답 필드 최소화"이다.
- 아직 근거가 부족한 항목은 Stored XSS의 브라우저 e2e, 채팅 이미지 업로드, CSRF token/guard, Rate Limit guard 적용, Race Condition 동시성 e2e, Toss sandbox 실결제 증거이다.
- 이 문서는 최종 보고서가 아니라, `docs/report-prep/phase1-security-status.md`와 실제 코드 근거를 바탕으로 한 보고서용 문장 초안이다.

## 2. 취약점별 보고서 초안

### IDOR / BOLA

#### 관련 요구사항
- FR: FR-09, FR-18, FR-27, FR-30, FR-37, FR-43~47
- SR: SR-06, SR-07, SR-08, SR-10, SR-30, SR-35, SR-36
- NFR: NFR-05, NFR-07, NFR-08

#### 관련 기능/엔드포인트
- `GET /api/chats/:id`, `GET /api/chats/:id/messages`
- `GET /api/transactions/:id`, `GET /api/payments/:id/receipt`
- `GET /api/notifications`, `POST /api/notifications/:id/read`
- `PATCH /api/products/:id`, `DELETE /api/products/:id`, `POST /api/products/:id/images`
- `GET /api/users/:id/private`

#### 취약했던 문제
객체 ID를 URL이나 요청 본문에서 직접 받는 API에서 현재 사용자가 해당 객체의 소유자 또는 참여자인지 검증하지 않으면, 로그인한 사용자가 다른 사용자의 채팅방, 거래, 결제 영수증, 알림을 조회하거나 조작할 수 있다. 보고서에서는 이를 "ID만 바꿔 타인 객체에 접근하는 직접 객체 참조 취약 패턴"으로 설명한다.

#### 공격 시나리오
보안 검증 관점에서는 사용자 A가 자신의 채팅방 또는 거래 상세 URL을 확인한 뒤, URL의 UUID를 사용자 B 소유 객체의 UUID로 바꿔 요청하는 시나리오를 사용한다. 정상적인 패치 후에는 인증이 되어 있어도 참여자나 소유자가 아니면 403 또는 404가 반환되어야 한다.

#### 패치 내용
현재 구현은 공통 인증을 `JwtAuthGuard`에서 수행하고, 각 도메인 서비스에서 seller, buyer, participant, userId를 DB 기준으로 재확인한다. 상품 수정/삭제/업로드는 `assertProductSeller`, 채팅 조회/메시지는 `assertParticipant`, 거래/결제는 `assertBuyer` 또는 `assertParticipant`, 알림 읽음은 `{ id, userId }` 조건으로 제한한다.

#### 패치 근거 파일
| 파일 | 근거 코드/역할 | 설명 |
|---|---|---|
| `backend/src/modules/products/products.service.ts` | `assertProductSeller` | 상품 수정, 삭제, 상태 변경, 이미지 업로드 전에 sellerId를 비교한다. |
| `backend/src/modules/chats/chats.service.ts` | `assertParticipant`, `assertChatParticipant` | 채팅방 상세, 메시지 조회, 메시지 전송, 읽음 처리 전에 buyer/seller 참여 여부를 확인한다. |
| `backend/src/modules/transactions/transactions.service.ts` | `assertSeller`, `assertParticipant`, `getTransactionForParticipant` | 거래 상태 변경과 상세 조회를 거래 당사자로 제한한다. |
| `backend/src/modules/payments/payments.service.ts` | `assertBuyer`, `assertParticipant` | 결제 생성/승인/확정/환불/영수증 접근을 구매자 또는 당사자로 제한한다. |
| `backend/src/modules/notifications/notifications.service.ts` | `where: { id, userId }` | 타인 알림 ID를 전달해도 조회되지 않게 한다. |
| `backend/src/modules/users/users.service.ts` | `getPrivateProfile` | private profile은 본인 또는 ADMIN만 조회 가능하다. |

#### 전후 비교 초안
| 구분 | 설명 |
|---|---|
| 패치 전 | 객체 ID만으로 DB를 조회하고 반환하면, 인증된 제3자가 URL의 ID를 변경해 타인 객체에 접근할 수 있다. |
| 패치 후 | 토큰의 subject와 DB의 소유자/참여자 필드를 비교하고, 불일치하면 403 또는 404로 차단한다. |

#### 검증 방법
| 검증 방식 | 내용 | 현재 상태 |
|---|---|---|
| 수동 검증 | 사용자 A 토큰으로 사용자 B의 채팅/거래/결제/알림 ID에 접근한다. | 계획 필요 |
| 자동화 테스트 | 서비스/컨트롤러 spec에서 비소유자, 비참여자, 타인 알림 접근 차단을 검증한다. | 기존 unit/controller spec 있음, e2e 테스트 미작성 |

#### 보고서용 문단 초안
본 서비스는 상품, 채팅, 거래, 결제처럼 객체 ID를 직접 다루는 API가 많기 때문에 IDOR/BOLA가 핵심 보안 위험이다. 취약한 구현에서는 인증된 사용자가 URL의 객체 ID만 변경해 타인의 채팅방이나 거래 상세를 조회할 수 있다. 패치된 구현은 공통 인증 이후 각 서비스 계층에서 현재 사용자와 DB의 소유자 또는 참여자 필드를 다시 대조한다. 상품 수정과 이미지 업로드는 판매자만 가능하고, 채팅과 거래 및 결제 영수증은 참여자 또는 당사자만 접근할 수 있다. 알림도 요청 파라미터의 사용자 ID를 신뢰하지 않고 토큰의 사용자 ID로만 필터링한다. 이 방식은 권한 검사를 컨트롤러 입력이 아니라 데이터 접근 직전에 수행하므로 객체 ID 변조 공격을 방어할 수 있다. 다만 최종 보고서에는 실제 HTTP e2e 요청으로 타 사용자 토큰 접근이 차단되는 실행 결과를 추가하는 것이 필요하다.

### Stored XSS

#### 관련 요구사항
- FR: FR-07, FR-13, FR-17, FR-39~41
- SR: SR-11, SR-13
- NFR: NFR-07, NFR-08

#### 관련 기능/엔드포인트
- 상품 설명 등록/조회: `POST /api/products`, `GET /api/products/:id`
- 채팅 메시지: `POST /api/chats/:id/messages`, Socket.IO `message`
- 신고 설명 및 관리자 상세 화면

#### 취약했던 문제
사용자가 입력한 상품 설명, 채팅 메시지, 신고 설명을 HTML로 직접 삽입하면 저장된 스크립트가 다른 사용자의 브라우저에서 실행될 수 있다. 보고서에서는 이를 "사용자 입력을 HTML로 신뢰하는 렌더링 취약 패턴"으로 설명한다.

#### 공격 시나리오
검증 시나리오는 상품 설명 또는 채팅 메시지에 이벤트 핸들러가 포함된 HTML 문자열을 저장한 뒤, 다른 사용자가 해당 화면을 열었을 때 스크립트가 실행되는지 확인하는 방식이다. 실제 공격을 안내하기보다는, 저장 입력이 화면에 표시되는 경로에서 escape가 유지되는지 확인하는 보안 검증으로 다룬다.

#### 패치 내용
현재 프론트 구현은 상품 설명, 채팅 메시지, 신고 설명, 관리자 상세 설명을 `dangerouslySetInnerHTML`이 아니라 React 텍스트 바인딩으로 렌더링한다. 따라서 저장된 문자열은 HTML로 해석되지 않고 텍스트로 표시된다. 다만 서버 저장 전 sanitizer, CSP 정책, 브라우저 기반 e2e 검증은 아직 부족하므로 완료가 아니라 부분완료로 분류한다.

#### 패치 근거 파일
| 파일 | 근거 코드/역할 | 설명 |
|---|---|---|
| `frontend/src/pages/ProductDetailPage.tsx` | `<p>{product.description}</p>` | 상품 설명을 React 텍스트 바인딩으로 출력한다. |
| `frontend/src/pages/ChatsPage.tsx` | `<p>{message.content}</p>` | 채팅 메시지를 HTML로 주입하지 않는다. |
| `frontend/src/pages/AdminPages.tsx` | report/product description 출력 | 관리자 상세 화면에서도 설명 문자열을 텍스트로 렌더링한다. |
| `backend/src/modules/chats/chats.service.spec.ts` | `dangerouslySetInnerHTML` 미포함 검증 | 응답 객체에 위험 렌더링 속성이 없음을 확인한다. |

#### 전후 비교 초안
| 구분 | 설명 |
|---|---|
| 패치 전 | 사용자 입력을 `dangerouslySetInnerHTML` 또는 DOM 직접 삽입으로 출력하면 저장된 HTML이 실행될 수 있다. |
| 패치 후 | React 텍스트 바인딩을 사용해 사용자 입력을 HTML로 해석하지 않고 문자열로 표시한다. |

#### 검증 방법
| 검증 방식 | 내용 | 현재 상태 |
|---|---|---|
| 수동 검증 | XSS payload를 상품 설명/채팅 메시지로 저장하고 화면에서 스크립트가 실행되지 않는지 확인한다. | 계획 필요 |
| 자동화 테스트 | Playwright 등으로 alert 미발생과 텍스트 표시를 확인한다. | 브라우저 e2e 테스트 미작성, 일부 unit 근거만 있음 |

#### 보고서용 문단 초안
Stored XSS는 상품 설명이나 채팅 메시지처럼 다른 사용자가 다시 조회하는 입력값에서 발생할 수 있다. 취약한 구현에서는 사용자 입력 문자열을 HTML로 직접 삽입하여 저장된 스크립트가 조회자 브라우저에서 실행될 수 있다. 현재 프론트엔드 구현은 상품 설명과 채팅 메시지를 React 텍스트 바인딩으로 렌더링하므로 입력값을 HTML로 해석하지 않는다. 코드 검색 결과 production 프론트에서 `dangerouslySetInnerHTML` 사용은 확인되지 않았다. 이 점은 XSS 방어의 중요한 근거로 사용할 수 있다. 다만 서버 저장 전 sanitizer와 CSP 적용 여부, 브라우저 기반 자동화 검증은 아직 부족하다. 따라서 보고서에서는 React escaping 기반 방어는 패치 근거로 제시하되, Stored XSS 항목은 추가 e2e 검증이 필요한 부분완료 항목으로 정리한다.

### SQL Injection

#### 관련 요구사항
- FR: FR-13
- SR: SR-12
- NFR: NFR-07, NFR-08

#### 관련 기능/엔드포인트
- `GET /api/products/search`
- `GET /api/products`
- `GET /api/admin/products`
- `GET /api/admin/users`

#### 취약했던 문제
검색어를 SQL 문자열에 직접 이어 붙이면 사용자가 입력한 특수 문자열이 쿼리 구조를 변경할 수 있다. 보고서에서는 이를 "검색어를 SQL 문자열 보간에 사용하는 취약 패턴"으로 설명한다.

#### 공격 시나리오
상품 검색창에 일반 검색어 대신 SQL 조건처럼 보이는 문자열을 입력해, 검색 조건 우회나 비정상 데이터 노출이 발생하는지 확인한다. 현재 코드 기준 검증 목적은 해당 문자열이 SQL로 실행되지 않고 단순 검색어로 처리되는지 확인하는 것이다.

#### 패치 내용
현재 상품 검색과 관리자 검색은 Prisma `findMany`, `count`, `where`, `contains`, `mode: 'insensitive'` 조건을 사용한다. production 코드에서 `$queryRawUnsafe` 사용은 확인되지 않으며, 여러 서비스 테스트에서 `$queryRawUnsafe`가 호출되지 않음을 확인한다.

#### 패치 근거 파일
| 파일 | 근거 코드/역할 | 설명 |
|---|---|---|
| `backend/src/modules/products/products.service.ts` | `buildProductWhere`, `findMany` | 검색어를 Prisma 조건 객체로 전달한다. |
| `backend/src/modules/admin/admin.service.ts` | `buildProductWhere`, user search where | 관리자 검색도 Prisma 조건을 사용한다. |
| `backend/prisma/schema.prisma` | Prisma ORM schema | DB 접근은 Prisma 모델 기반으로 수행한다. |
| `backend/src/modules/products/products.service.spec.ts` | `$queryRawUnsafe` 미호출 검증 | 상품 검색 경로에서 raw unsafe query를 사용하지 않음을 테스트한다. |

#### 전후 비교 초안
| 구분 | 설명 |
|---|---|
| 패치 전 | 검색어를 SQL 문자열에 직접 보간하면 입력값이 쿼리 조건을 변형할 수 있다. |
| 패치 후 | 검색어는 Prisma 조건 객체의 값으로 전달되어 SQL 구조를 직접 구성하지 않는다. |

#### 검증 방법
| 검증 방식 | 내용 | 현재 상태 |
|---|---|---|
| 수동 검증 | SQLi 형태의 검색어를 넣고 비정상 전체 조회나 오류 노출이 없는지 확인한다. | 계획 필요 |
| 자동화 테스트 | production 코드에서 `$queryRawUnsafe` 미사용, 검색 결과 정상 처리를 검증한다. | 기존 unit/static 근거 있음, e2e 테스트 미작성 |

#### 보고서용 문단 초안
상품 검색 기능은 사용자 입력을 DB 조회 조건으로 사용하기 때문에 SQL Injection 검증 대상이다. 취약한 구현에서는 검색어를 SQL 문자열에 직접 연결해 쿼리 구조가 변조될 수 있다. 현재 구현은 Prisma ORM의 `findMany`와 조건 객체를 사용해 검색어를 값으로 전달한다. 검색 조건은 `title`, `description`, `category`의 `contains` 조건으로 구성되며 production 코드에서 `$queryRawUnsafe` 사용은 확인되지 않았다. 테스트에서도 주요 서비스가 `$queryRawUnsafe`를 호출하지 않음을 확인한다. 이 근거는 SQL Injection 패치 항목으로 보고서 활용도가 높다. 최종 보고서에는 SQLi 형태의 검색어를 실제 API에 입력했을 때 정상 검색 처리 또는 빈 결과로 끝나는 e2e 결과를 추가하면 된다.

### 파일 업로드 취약점

#### 관련 요구사항
- FR: FR-08, FR-20
- SR: SR-16, SR-17, SR-18, SR-19, SR-20, SR-21
- NFR: NFR-07, NFR-08

#### 관련 기능/엔드포인트
- `POST /api/products/:id/images`
- 채팅 이미지 메시지 FR-20은 현재 업로드 플로우 미확인

#### 취약했던 문제
이미지 업로드에서 확장자나 MIME 타입만 신뢰하면 스크립트 파일이나 실행 가능한 파일을 이미지로 위장해 저장할 수 있다. 보고서에서는 이를 "원본 파일명과 클라이언트 MIME만 신뢰하는 업로드 취약 패턴"으로 설명한다.

#### 공격 시나리오
검증 시나리오는 정상 이미지와 함께 이중 확장자 파일, SVG/HTML/PHP 계열 파일, MIME 타입과 실제 파일 시그니처가 다른 파일을 업로드해 서버가 거부하는지 확인하는 방식이다. 실제 악성 파일 실행 안내가 아니라 업로드 검증 정책을 확인하는 보안 테스트로 다룬다.

#### 패치 내용
상품 이미지 업로드는 인증 사용자와 상품 seller를 확인한 뒤 파일 개수, 크기, 빈 파일, 위험 확장자, 허용 확장자, MIME 타입, JPEG/PNG/WebP 매직바이트를 검증한다. 파일명은 원본을 사용하지 않고 UUID 기반으로 생성한다. 단, 채팅 이미지 업로드는 실제 플로우가 확인되지 않아 파일 업로드 취약점 전체를 완료로 쓰면 안 된다.

#### 패치 근거 파일
| 파일 | 근거 코드/역할 | 설명 |
|---|---|---|
| `backend/src/main.ts` | Fastify multipart limits | 업로드 크기, 파일 수, fields 제한을 설정한다. |
| `backend/src/modules/products/products.controller.ts` | multipart 파일 추출 | file part만 허용하고 service로 전달한다. |
| `backend/src/modules/products/products.service.ts` | `validateImage`, `detectImageType` | 확장자, MIME, 매직바이트, UUID 파일명, seller 검증을 수행한다. |
| `backend/src/modules/products/products.service.spec.ts` | 업로드 보안 테스트 | UUID 파일명, PHP double extension, MIME/magic-byte mismatch를 검증한다. |

#### 전후 비교 초안
| 구분 | 설명 |
|---|---|
| 패치 전 | 원본 파일명, 확장자, MIME만 보고 저장하면 위장 파일이 업로드될 수 있다. |
| 패치 후 | 서버가 확장자, MIME, 실제 시그니처를 모두 대조하고 UUID 파일명으로 저장한다. |

#### 검증 방법
| 검증 방식 | 내용 | 현재 상태 |
|---|---|---|
| 수동 검증 | 정상 이미지와 위장 파일을 multipart로 업로드해 성공/거부 결과를 캡처한다. | 계획 필요 |
| 자동화 테스트 | 상품 이미지 업로드 service unit test가 위험 파일과 mismatch를 거부한다. | 기존 unit test 있음, multipart e2e 테스트 미작성 |

#### 보고서용 문단 초안
파일 업로드 기능은 서버에 저장되는 파일의 형식과 이름을 공격자가 어느 정도 제어할 수 있어 중요한 검증 대상이다. 취약한 구현에서는 확장자나 MIME 타입만 확인하고 원본 파일명을 그대로 저장해 스크립트 파일 업로드 위험이 발생할 수 있다. 현재 상품 이미지 업로드는 상품 판매자만 수행할 수 있으며, 파일 개수와 크기 제한을 적용한다. 또한 위험 확장자를 차단하고 jpg, jpeg, png, webp만 허용하며, MIME 타입과 실제 매직바이트를 서로 대조한다. 저장 파일명은 UUID 기반으로 다시 생성되어 원본 파일명을 신뢰하지 않는다. 이 구현은 상품 이미지 업로드 취약점 패치 근거로 활용할 수 있다. 다만 채팅 이미지 업로드 플로우는 아직 확인되지 않았으므로 보고서에서는 파일 업로드 전체 완료가 아니라 상품 이미지 기준 패치로 범위를 제한해야 한다.

### 결제 금액 조작 Price Tampering

#### 관련 요구사항
- FR: FR-30, FR-31, FR-32, FR-33, FR-34, FR-36, FR-37, FR-38
- SR: SR-22, SR-23, SR-24, SR-25, SR-26, SR-27, SR-28
- NFR: NFR-04, NFR-07, NFR-08

#### 관련 기능/엔드포인트
- `POST /api/transactions`
- `POST /api/payments`
- `POST /api/payments/:id/approve`
- `POST /api/payments/:id/confirm`
- `POST /api/payments/:id/refund`

#### 취약했던 문제
결제 요청에서 클라이언트가 보낸 금액을 그대로 사용하면 사용자가 상품 가격보다 낮은 금액으로 결제를 시도할 수 있다. 보고서에서는 이를 "결제 금액을 클라이언트 입력에서 신뢰하는 취약 패턴"으로 설명한다.

#### 공격 시나리오
검증 시나리오는 결제 생성 요청에 `amount`, `price`, `status`, `userId` 같은 필드를 추가하거나 승인 요청의 amount를 DB 금액과 다르게 보내 서버가 거부하는지 확인하는 방식이다. 목적은 서버가 결제 금액의 단일 기준을 DB 상태로 유지하는지 검증하는 것이다.

#### 패치 내용
거래 생성 시 `amount`는 상품의 DB `price`에서 저장된다. 결제 생성 DTO는 `transactionId`와 `idempotencyKey`만 허용하고, 결제 생성 시 `Transaction.amount`와 `Product.price`를 대조한다. Toss 승인 요청과 provider 응답도 DB Payment amount와 비교하며, 중복 결제는 `idempotencyKey`, `transactionId`, `orderId` unique 제약과 서비스 로직으로 제한한다.

#### 패치 근거 파일
| 파일 | 근거 코드/역할 | 설명 |
|---|---|---|
| `backend/src/modules/transactions/transactions.service.ts` | `amount: product.price` | 거래 생성 시 서버 DB 상품 가격을 거래 금액으로 저장한다. |
| `backend/src/modules/payments/dto/create-payment.dto.ts` | `transactionId`, `idempotencyKey`만 허용 | 결제 생성 body에서 amount를 받지 않는다. |
| `backend/src/modules/payments/payments.service.ts` | `assertServerAmountConsistent`, `assertApprovalRequestMatches` | 결제 생성과 승인 단계에서 DB 금액과 요청/PG 응답을 대조한다. |
| `backend/prisma/schema.prisma` | Payment unique 제약 | transactionId, idempotencyKey, orderId 중복을 제한한다. |

#### 전후 비교 초안
| 구분 | 설명 |
|---|---|
| 패치 전 | 클라이언트가 보낸 amount를 결제 금액으로 사용하면 낮은 금액 결제가 가능하다. |
| 패치 후 | 서버가 거래와 상품 DB 가격을 기준으로 금액을 확정하고, 요청/PG 응답 금액과 대조한다. |

#### 검증 방법
| 검증 방식 | 내용 | 현재 상태 |
|---|---|---|
| 수동 검증 | amount 변조 결제 생성/승인 요청을 보내 400 또는 409 응답을 확인한다. | 계획 필요 |
| 자동화 테스트 | 결제 service spec에서 buyer 검증, amount mismatch, idempotency 재사용/충돌을 검증한다. | 기존 unit test 있음, Toss sandbox 증거 부족 |

#### 보고서용 문단 초안
안전결제 기능에서 가장 중요한 무결성 요구사항은 결제 금액을 클라이언트가 결정하지 못하게 하는 것이다. 취약한 구현에서는 사용자가 결제 요청 본문에 낮은 amount를 넣어 상품 가격보다 적은 금액으로 결제를 시도할 수 있다. 현재 구현은 거래 생성 시 상품 DB 가격을 거래 금액으로 저장하고, 결제 생성 DTO에서는 amount를 받지 않는다. 결제 생성 시에는 거래 금액과 상품 가격을 다시 대조하여 불일치하면 오류를 반환한다. Toss 승인 단계에서도 요청 amount와 provider 응답 amount를 DB payment amount와 비교한다. 중복 결제는 idempotency key와 unique 제약으로 제한한다. 따라서 결제 금액 조작 취약점은 현재 코드와 unit test 근거가 충분하며, 최종 보고서에는 변조 요청과 정상 차단 응답을 캡처해 전후 비교로 제시하면 된다.

### 관리자 권한 우회

#### 관련 요구사항
- FR: FR-42, FR-43, FR-44, FR-45, FR-46
- SR: SR-05, SR-09, SR-15, SR-36
- NFR: NFR-04, NFR-07, NFR-08

#### 관련 기능/엔드포인트
- `GET /api/admin/reports`, `PATCH /api/admin/reports/:id/status`
- `GET /api/admin/products`, `PATCH /api/admin/products/:id/hide`
- `GET /api/admin/users`, `PATCH /api/admin/users/:id/suspend`
- `GET /api/admin/logs`

#### 취약했던 문제
관리자 API가 단순히 프론트 화면 노출 여부나 요청 body의 role 값을 신뢰하면 일반 사용자가 관리자 기능에 접근할 수 있다. 보고서에서는 이를 "클라이언트 role 또는 UI 라우팅만 신뢰하는 권한 우회 패턴"으로 설명한다.

#### 공격 시나리오
검증 시나리오는 일반 사용자 토큰으로 관리자 URL을 직접 호출하거나, 회원가입/수정 요청에 `role: "ADMIN"`을 주입하는 방식이다. 패치 후에는 서버가 DB role/status를 기준으로 접근을 거부해야 한다.

#### 패치 내용
관리자 컨트롤러에는 class level로 `JwtAuthGuard`, `RolesGuard`, `@Roles(Role.ADMIN)`가 적용되어 있다. `JwtAuthGuard`는 JWT payload role을 그대로 사용하지 않고 DB에서 사용자 role/status를 재조회한다. `RolesGuard`는 ADMIN role뿐 아니라 ACTIVE status도 요구한다. DTO whitelist는 role/status 주입을 거부한다.

#### 패치 근거 파일
| 파일 | 근거 코드/역할 | 설명 |
|---|---|---|
| `backend/src/modules/admin/admin-users.controller.ts` | `@UseGuards`, `@Roles(Role.ADMIN)` | 사용자 제재 API를 관리자만 접근 가능하게 한다. |
| `backend/src/modules/admin/admin-products.controller.ts` | `@UseGuards`, `@Roles(Role.ADMIN)` | 상품 숨김/복구 API를 관리자만 접근 가능하게 한다. |
| `backend/src/modules/admin/admin-reports.controller.ts` | `@UseGuards`, `@Roles(Role.ADMIN)` | 신고 처리 API를 관리자만 접근 가능하게 한다. |
| `backend/src/common/guards/jwt-auth.guard.ts` | DB role/status 재조회 | JWT payload의 stale role을 신뢰하지 않는다. |
| `backend/src/common/guards/roles.guard.ts` | role + ACTIVE 검사 | 정지된 관리자 접근도 차단한다. |

#### 전후 비교 초안
| 구분 | 설명 |
|---|---|
| 패치 전 | 프론트 라우팅이나 클라이언트 role 값만 믿으면 일반 사용자가 관리자 API를 직접 호출할 수 있다. |
| 패치 후 | 모든 관리자 API에서 서버 guard가 DB 기준 ADMIN + ACTIVE 상태를 요구한다. |

#### 검증 방법
| 검증 방식 | 내용 | 현재 상태 |
|---|---|---|
| 수동 검증 | USER, SUSPENDED ADMIN, ACTIVE ADMIN 토큰으로 관리자 API 접근 결과를 비교한다. | 계획 필요 |
| 자동화 테스트 | admin controller metadata, RolesGuard, JwtAuthGuard, DTO role injection 테스트가 있다. | 기존 unit/controller/DTO spec 있음, e2e 테스트 미작성 |

#### 보고서용 문단 초안
관리자 기능은 신고 처리, 상품 숨김, 사용자 정지처럼 서비스 상태를 직접 변경하므로 권한 우회 위험이 크다. 취약한 구현에서는 관리자 메뉴를 프론트에서 숨기는 수준에 머물거나, 클라이언트가 보낸 role 값을 신뢰해 일반 사용자가 관리자 API에 접근할 수 있다. 현재 구현은 모든 관리자 컨트롤러에 `JwtAuthGuard`, `RolesGuard`, `@Roles(Role.ADMIN)`를 적용한다. 인증 가드는 JWT payload의 role을 최종 권한으로 사용하지 않고 DB에서 사용자 role과 status를 재조회한다. 역할 가드는 ADMIN role뿐 아니라 ACTIVE 상태도 요구하므로 정지된 관리자 토큰도 차단된다. 회원가입과 프로필 수정 DTO는 role/status 주입을 허용하지 않는다. 이 항목은 관리자 권한 우회 방어의 핵심 패치 근거로 보고서에 활용할 수 있다.

### CSRF

#### 관련 요구사항
- FR: FR-02, FR-42~46
- SR: SR-03, SR-38
- NFR: NFR-07, NFR-08

#### 관련 기능/엔드포인트
- `POST /api/auth/refresh`, `POST /api/auth/logout`
- 상태 변경 API 전반
- 관리자 상태 변경 API

#### 취약했던 문제
쿠키 인증만으로 상태 변경 API가 동작하면 외부 사이트에서 사용자의 브라우저를 통해 의도하지 않은 요청이 전송될 수 있다. 보고서에서는 이를 "쿠키 기반 인증 endpoint에 CSRF token 검증이 없는 위험"으로 설명한다.

#### 공격 시나리오
검증 시나리오는 외부 origin에서 인증 쿠키가 포함될 수 있는 요청을 유도했을 때, 서버가 origin, SameSite, Authorization 요구사항, CSRF token으로 요청을 차단하는지 확인하는 것이다. 현재 프로젝트에서는 explicit CSRF token/guard가 없으므로 검증은 한계 확인 중심이다.

#### 패치 내용
현재 access token은 localStorage가 아닌 메모리에 보관되고, 일반 API 요청은 Bearer Authorization 헤더를 사용한다. refresh token cookie는 HttpOnly, SameSite Strict, production secure 설정을 갖는다. CORS는 허용 origin과 credentials를 설정한다. 다만 CSRF token/guard는 확인되지 않아 부분완료로만 정리한다.

#### 패치 근거 파일
| 파일 | 근거 코드/역할 | 설명 |
|---|---|---|
| `backend/src/modules/auth/auth.controller.ts` | refresh cookie option | `httpOnly`, `sameSite: 'strict'`, production secure를 설정한다. |
| `frontend/src/api/client.ts` | access token memory storage | access token을 localStorage/sessionStorage에 저장하지 않는다. |
| `backend/src/main.ts` | CORS credentials + origin | 허용 origin 기준 CORS 설정을 적용한다. |

#### 전후 비교 초안
| 구분 | 설명 |
|---|---|
| 패치 전 | 쿠키만으로 상태 변경 요청이 처리되면 외부 사이트의 요청 유도가 위험하다. |
| 패치 후 | Bearer access token 구조와 SameSite refresh cookie로 일부 위험을 낮췄지만, CSRF token/guard는 아직 보완 필요하다. |

#### 검증 방법
| 검증 방식 | 내용 | 현재 상태 |
|---|---|---|
| 수동 검증 | 외부 origin 요청에서 상태 변경 API가 Authorization 없이 거부되는지 확인한다. | 계획 필요 |
| 자동화 테스트 | CSRF token/guard 테스트를 작성한다. | 테스트 미작성, guard 미구현 |

#### 보고서용 문단 초안
CSRF는 브라우저가 쿠키를 자동으로 첨부한다는 특성을 이용해 사용자가 의도하지 않은 상태 변경 요청을 보내게 하는 취약점이다. 현재 프로젝트는 일반 API 인증에 Bearer access token을 사용하고, access token을 브라우저 저장소가 아니라 메모리에 보관한다. refresh token cookie는 HttpOnly와 SameSite Strict 설정을 사용해 cross-site 전송 위험을 낮춘다. 또한 CORS origin을 제한해 프론트 출처를 통제한다. 그러나 현재 코드에서 별도의 CSRF token 발급 및 검증 guard는 확인되지 않았다. 따라서 보고서에서는 CSRF를 완전 패치 항목으로 쓰지 않고, 현재 구조가 제공하는 완화 효과와 남은 한계를 분리해 기술해야 한다. 3차 작업에서는 CSRF 적용 범위를 결정하고 자동화 검증을 추가하는 것이 필요하다.

### Race Condition / 중복 판매

#### 관련 요구사항
- FR: FR-23, FR-24, FR-25, FR-26, FR-29, FR-30~36
- SR: SR-08, SR-24, SR-26, SR-27
- NFR: NFR-08

#### 관련 기능/엔드포인트
- `PATCH /api/transactions/:id/reserve`
- `PATCH /api/transactions/:id/cancel`
- `PATCH /api/transactions/:id/complete`
- `POST /api/payments`
- `POST /api/payments/:id/confirm`

#### 취약했던 문제
동시에 여러 구매자가 같은 상품을 예약하거나 결제할 때 상태 확인과 업데이트가 원자적으로 처리되지 않으면 중복 판매가 발생할 수 있다. 보고서에서는 이를 "읽기 후 조건 없는 업데이트로 인한 상태 경합 취약 패턴"으로 설명한다.

#### 공격 시나리오
검증 시나리오는 같은 상품에 대해 두 개 이상의 예약 또는 결제 요청을 거의 동시에 보내 한 건만 성공하고 나머지는 충돌로 처리되는지 확인하는 것이다. 실제 DB 기반 동시성 테스트가 필요하다.

#### 패치 내용
현재 거래 예약/취소/완료와 구매 확정은 Prisma `$transaction` 안에서 현재 상태를 조회하고 조건부 `updateMany`의 count를 검사한다. 상품 상태가 이미 바뀐 경우 `ConflictException`을 반환한다. 결제는 transactionId, idempotencyKey, orderId unique 제약과 서비스 로직으로 중복 생성을 제한한다. 다만 동시 요청 e2e 또는 integration test 증거는 아직 부족하다.

#### 패치 근거 파일
| 파일 | 근거 코드/역할 | 설명 |
|---|---|---|
| `backend/src/modules/transactions/transactions.service.ts` | `$transaction`, 조건부 `updateMany` | 예약/취소/완료 시 상태 경합을 감지한다. |
| `backend/src/modules/payments/payments.service.ts` | 결제 생성 transaction, idempotency 처리 | 같은 거래 결제 중복 생성을 제한한다. |
| `backend/prisma/schema.prisma` | `Payment.transactionId`, `idempotencyKey`, `orderId` unique | DB 레벨 중복 결제 제약을 둔다. |

#### 전후 비교 초안
| 구분 | 설명 |
|---|---|
| 패치 전 | 상태를 읽은 뒤 조건 없이 업데이트하면 동시 요청에서 여러 거래가 성공할 수 있다. |
| 패치 후 | transaction과 조건부 update count 확인으로 이미 변경된 상태를 감지하고 충돌 처리한다. |

#### 검증 방법
| 검증 방식 | 내용 | 현재 상태 |
|---|---|---|
| 수동 검증 | 동일 상품에 동시 예약/결제 요청을 보내 1건만 성공하는지 확인한다. | 계획 필요 |
| 자동화 테스트 | 실제 DB integration/e2e에서 동시 요청을 검증한다. | service unit 근거 일부 있음, 동시성 테스트 미작성 |

#### 보고서용 문단 초안
중고거래 서비스에서는 하나의 상품이 동시에 여러 구매자에게 판매되지 않도록 상태 전이를 안전하게 처리해야 한다. 취약한 구현에서는 상품 상태를 확인한 뒤 조건 없이 업데이트해 동시 요청에서 중복 예약이나 중복 판매가 발생할 수 있다. 현재 거래 서비스는 예약, 취소, 완료 처리를 Prisma transaction 내부에서 수행하고, 상품과 거래 상태를 조건부로 업데이트한다. 업데이트 count가 1이 아니면 이미 상태가 변경된 것으로 판단해 충돌을 반환한다. 결제 서비스도 transactionId와 idempotencyKey 기반으로 중복 결제를 제한한다. 이 구조는 Race Condition 완화 근거로 사용할 수 있다. 다만 실제 동시 요청을 실행한 e2e 또는 integration test가 없으므로 최종 보고서에서는 부분완료와 추가 검증 필요로 표시해야 한다.

### Mass Assignment

#### 관련 요구사항
- FR: FR-01, FR-04, FR-07, FR-23, FR-30, FR-39~46
- SR: SR-11, SR-15, SR-22, SR-36
- NFR: NFR-07, NFR-08

#### 관련 기능/엔드포인트
- 회원가입, 프로필 수정, 상품 등록/수정, 채팅 생성, 거래 생성, 결제 생성, 신고 생성, 관리자 처리 API

#### 취약했던 문제
요청 body를 그대로 DB create/update에 전달하면 사용자가 `role`, `status`, `sellerId`, `buyerId`, `amount`, `adminId` 같은 권한 필드를 주입할 수 있다. 보고서에서는 이를 "클라이언트 제공 객체를 서버 상태로 그대로 반영하는 취약 패턴"으로 설명한다.

#### 공격 시나리오
검증 시나리오는 회원가입 요청에 `role: "ADMIN"`, 상품 생성 요청에 `sellerId`, 결제 생성 요청에 `amount/status`, 신고 요청에 `reporterId/adminId`를 추가해 서버가 거부하는지 확인하는 방식이다.

#### 패치 내용
전역 `ValidationPipe`는 whitelist, forbidNonWhitelisted, transform 옵션을 사용한다. 각 DTO는 클라이언트가 수정 가능한 필드만 정의하고, 권한/상태/소유자 필드는 서비스에서 인증 사용자와 DB 상태로 결정한다. DTO spec은 여러 도메인에서 권한 필드 주입이 거부되는지 검증한다.

#### 패치 근거 파일
| 파일 | 근거 코드/역할 | 설명 |
|---|---|---|
| `backend/src/main.ts` | `ValidationPipe` 전역 설정 | DTO 외 필드를 400으로 거부한다. |
| `backend/src/modules/*/dto/*.ts` | DTO allowlist | 권한 필드를 DTO에 포함하지 않는다. |
| `backend/prisma/schema.prisma` | DTO policy comment | 권한 필드는 클라이언트가 제공하지 않는다는 정책을 문서화한다. |
| `backend/src/modules/*/dto/*.spec.ts` | injection 거부 테스트 | role/status/userId/sellerId/amount 등 주입 거부를 검증한다. |

#### 전후 비교 초안
| 구분 | 설명 |
|---|---|
| 패치 전 | body 객체를 그대로 저장하면 권한 필드 주입이 가능하다. |
| 패치 후 | DTO whitelist와 서비스 파생 값으로 클라이언트 권한 필드가 거부된다. |

#### 검증 방법
| 검증 방식 | 내용 | 현재 상태 |
|---|---|---|
| 수동 검증 | 핵심 API에 초과 필드를 넣어 400 응답을 확인한다. | 계획 필요 |
| 자동화 테스트 | DTO spec에서 권한/상태 필드 주입 거부를 확인한다. | 기존 DTO spec 있음, e2e 테스트 미작성 |

#### 보고서용 문단 초안
Mass Assignment는 클라이언트가 전달한 객체를 서버가 과도하게 신뢰할 때 발생한다. 이 프로젝트에서 위험한 필드는 role, status, sellerId, buyerId, reporterId, amount처럼 권한이나 상태를 결정하는 값이다. 현재 구현은 전역 ValidationPipe에서 whitelist와 forbidNonWhitelisted 옵션을 활성화해 DTO에 없는 필드를 거부한다. 각 DTO는 사용자가 입력 가능한 필드만 정의하고 권한 필드는 제외한다. 서비스 계층은 인증 토큰의 subject와 DB 상태를 기준으로 sellerId, buyerId, amount, status를 결정한다. 여러 DTO 테스트가 권한 필드 주입을 거부하는지 검증한다. 이 항목은 실제 코드와 테스트 근거가 충분해 보고서 활용도가 높다.

### Rate Limit 부재

#### 관련 요구사항
- FR: FR-02, FR-30, FR-47
- SR: SR-02, SR-37
- NFR: NFR-02, NFR-08

#### 관련 기능/엔드포인트
- `POST /api/auth/login`
- 결제 API
- 채팅 송신 API
- 알림 API

#### 취약했던 문제
로그인, 결제, 채팅처럼 비용이 큰 API에 요청 제한이 없으면 무차별 대입, 외부 결제 비용 유발, 자원 고갈 위험이 생긴다. 보고서에서는 이를 "요청 빈도 제한이 실제 guard로 연결되지 않은 위험"으로 설명한다.

#### 공격 시나리오
검증 시나리오는 짧은 시간 안에 로그인 실패 요청이나 결제 생성 요청을 반복해 429 또는 계정 잠금이 발생하는지 확인하는 방식이다. 현재는 로그인 실패 잠금은 근거가 있으나 Nest Throttler guard 적용 근거는 부족하다.

#### 패치 내용
현재 `ThrottlerModule` 설정과 환경변수 검증은 존재한다. 인증 서비스에는 Redis 기반 로그인 실패 카운터와 계정 잠금이 구현되어 있다. 그러나 `ThrottlerGuard` 전역 적용 또는 route level 적용은 확인되지 않아 Rate Limit 항목은 부분완료로 정리한다.

#### 패치 근거 파일
| 파일 | 근거 코드/역할 | 설명 |
|---|---|---|
| `backend/src/app.module.ts` | `ThrottlerModule.forRootAsync` | rate limit 설정값을 Nest module에 등록한다. |
| `backend/src/config/env.validation.ts` | `RATE_LIMIT_WINDOW`, `RATE_LIMIT_MAX` | rate limit 환경변수를 검증한다. |
| `backend/src/modules/auth/auth.service.ts` | `recordFailedLogin`, `isLocked` | 로그인 실패 카운터와 잠금 처리를 수행한다. |
| `backend/src/modules/redis/redis.service.ts` | login failure counter | Redis 기반 실패 횟수 저장을 담당한다. |

#### 전후 비교 초안
| 구분 | 설명 |
|---|---|
| 패치 전 | 반복 요청에 대한 서버 차단이 없으면 무차별 대입이나 비용 유발 공격이 가능하다. |
| 패치 후 | 로그인 실패 잠금은 구현되어 있으나, API 전체 Rate Limit guard 적용은 보완 필요하다. |

#### 검증 방법
| 검증 방식 | 내용 | 현재 상태 |
|---|---|---|
| 수동 검증 | 로그인 실패 5회 이상, 짧은 시간 반복 요청에서 잠금/429를 확인한다. | 로그인 잠금은 계획 가능, 429 검증은 guard 보강 필요 |
| 자동화 테스트 | 로그인 실패 잠금 unit test와 Throttler 429 e2e를 분리한다. | 로그인 실패 unit test 있음, RateLimit 429 테스트 미작성 |

#### 보고서용 문단 초안
Rate Limit은 인증, 결제, 채팅처럼 반복 요청의 비용이 큰 API에서 중요하다. 현재 프로젝트는 로그인 실패 횟수를 Redis에 기록하고 일정 횟수 이상 실패하면 계정을 잠그는 방어 로직을 갖고 있다. 또한 `ThrottlerModule`과 관련 환경변수 설정은 존재한다. 그러나 실제 요청을 제한하려면 `ThrottlerGuard`가 전역 또는 route level에 적용되어야 하는데, 1차 진단에서는 해당 적용 근거가 확인되지 않았다. 따라서 Rate Limit 부재 항목은 완전 패치가 아니라 부분완료로 분류해야 한다. 보고서에는 로그인 실패 잠금은 구현된 보안 통제로 작성하고, API rate limit 429 차단은 보완 필요로 표시한다. 3차 작업에서는 guard 적용과 반복 요청 e2e 테스트가 필요하다.

### 민감정보 노출

#### 관련 요구사항
- FR: FR-04, FR-12, FR-27, FR-37, FR-43~46, FR-47~50
- SR: SR-29, SR-30, SR-31, SR-39
- NFR: NFR-05, NFR-07, NFR-08

#### 관련 기능/엔드포인트
- 사용자 공개/비공개 프로필
- 상품 상세 seller 정보
- 채팅/거래/결제/관리자/알림 응답

#### 취약했던 문제
사용자 relation 전체를 응답하면 `passwordHash`, email, phone, token, secret 같은 민감정보가 의도치 않게 노출될 수 있다. 보고서에서는 이를 "DB relation 전체 반환 또는 민감 필드 select 누락 취약 패턴"으로 설명한다.

#### 공격 시나리오
검증 시나리오는 상품 상세, 채팅방, 거래 상세, 결제 영수증, 관리자 로그 응답에서 민감 필드명이 포함되는지 확인하는 방식이다. 정상 구현은 필요한 공개 필드만 반환해야 한다.

#### 패치 내용
현재 구현은 `@Exclude()` 직렬화 방식이 아니라 응답별 Prisma `select`로 공개 필드만 조회한다. 공개 사용자 정보는 id, nickname, avatarUrl, trustScore, completedTx 등으로 제한된다. private profile은 본인 또는 ADMIN만 조회 가능하다.

#### 패치 근거 파일
| 파일 | 근거 코드/역할 | 설명 |
|---|---|---|
| `backend/src/modules/users/users.service.ts` | public/private select 분리 | 공개 프로필에서 email/phone/passwordHash를 제외한다. |
| `backend/src/modules/products/products.service.ts` | `PUBLIC_SELLER_SELECT` | 상품 seller 공개 정보만 반환한다. |
| `backend/src/modules/chats/chats.service.ts` | `PUBLIC_USER_SELECT` | 채팅 참여자 공개 정보만 반환한다. |
| `backend/src/modules/transactions/transactions.service.ts` | `PUBLIC_USER_SELECT` | 거래 buyer/seller 공개 정보만 반환한다. |
| `backend/src/modules/payments/payments.service.ts` | `PAYMENT_RESPONSE_SELECT` | 결제 응답에서 공개 사용자 정보만 포함한다. |
| `backend/src/modules/admin/admin.service.ts` | admin response select | 관리자 로그 actor도 공개 사용자 필드로 제한한다. |

#### 전후 비교 초안
| 구분 | 설명 |
|---|---|
| 패치 전 | 사용자 relation 전체 반환 시 passwordHash, email, phone이 함께 노출될 수 있다. |
| 패치 후 | Prisma select로 필요한 공개 필드만 조회해 응답 객체에 민감정보가 들어오지 않게 한다. |

#### 검증 방법
| 검증 방식 | 내용 | 현재 상태 |
|---|---|---|
| 수동 검증 | API 응답 JSON에서 `passwordHash`, `phone`, secret, token 문자열이 없는지 확인한다. | 계획 필요 |
| 자동화 테스트 | 여러 service spec에서 민감 필드 미포함을 검증한다. | 기존 unit test 있음, e2e 테스트 미작성 |

#### 보고서용 문단 초안
민감정보 노출은 공개 API가 사용자 relation을 과도하게 반환할 때 발생한다. 이 프로젝트에서는 상품 판매자, 채팅 참여자, 거래 당사자, 결제 영수증, 관리자 로그 등 여러 응답에 사용자 정보가 포함된다. 현재 구현은 직렬화 단계에서 제거하는 방식보다 더 앞선 DB 조회 단계에서 Prisma select를 사용해 공개 필드만 선택한다. 공개 응답에는 id, nickname, avatarUrl, trustScore, completedTx 등 최소 정보만 포함되고 passwordHash, email, phone은 제외된다. private profile은 본인 또는 관리자만 조회 가능하도록 별도 권한 검사가 있다. 관련 unit test도 공개 응답에 민감 필드가 포함되지 않음을 검증한다. 따라서 민감정보 노출 방어는 보고서에 충분한 코드 근거와 테스트 근거를 제시할 수 있다.

### Webhook Forgery

#### 관련 요구사항
- FR: FR-38
- SR: SR-23, SR-24, SR-28
- NFR: NFR-04, NFR-07, NFR-08

#### 관련 기능/엔드포인트
- `POST /api/payments/webhook`

#### 취약했던 문제
결제 webhook endpoint는 외부에서 호출되므로 서명 검증 없이 body의 결제 상태를 신뢰하면 공격자가 임의로 결제 완료 상태를 만들 수 있다. 보고서에서는 이를 "공개 webhook 입력을 PG사 신뢰 데이터로 오인하는 취약 패턴"으로 설명한다.

#### 공격 시나리오
검증 시나리오는 잘못된 signature 또는 signature 없는 webhook 요청을 보내 결제 상태가 변경되지 않는지 확인하는 것이다. 또한 amount mismatch 요청은 서명이 맞더라도 DB 금액 대조에서 거부되어야 한다.

#### 패치 내용
현재 webhook verifier는 raw body와 timestamp를 HMAC-SHA256으로 서명하고, header signature와 `timingSafeEqual`로 비교한다. 서명 또는 timestamp가 없거나 secret이 없으면 검증은 실패한다. webhook 처리 후에도 orderId/paymentKey로 DB Payment를 찾고 amount를 DB 값과 비교한다. 중복 webhook은 이미 같은 상태면 ignored 처리한다.

#### 패치 근거 파일
| 파일 | 근거 코드/역할 | 설명 |
|---|---|---|
| `backend/src/modules/payments/payments.controller.ts` | raw body와 signature header 전달 | webhook 요청의 raw body 기반 검증 경로를 유지한다. |
| `backend/src/modules/payments/toss-webhook-verifier.ts` | HMAC + `timingSafeEqual` | 위조 signature를 거부한다. |
| `backend/src/modules/payments/payments.service.ts` | `handleWebhook` | 서명 검증 후 DB payment와 amount/status를 대조한다. |
| `backend/src/modules/payments/toss-webhook-verifier.spec.ts` | verifier unit test | 유효/무효 HMAC 검증을 테스트한다. |

#### 전후 비교 초안
| 구분 | 설명 |
|---|---|
| 패치 전 | webhook body의 status만 믿으면 위조 요청으로 결제 완료 처리가 가능하다. |
| 패치 후 | raw body HMAC 검증과 DB amount 대조를 통과한 요청만 상태를 반영한다. |

#### 검증 방법
| 검증 방식 | 내용 | 현재 상태 |
|---|---|---|
| 수동 검증 | invalid signature, missing signature, amount mismatch webhook 요청을 보낸다. | 계획 필요 |
| 자동화 테스트 | verifier spec과 payment service spec에서 signature 거부와 duplicate 처리 검증이 있다. | 기존 unit test 있음, HTTP e2e 테스트 미작성 |

#### 보고서용 문단 초안
Webhook Forgery는 공개 webhook endpoint가 외부 입력을 결제사 알림으로 신뢰할 때 발생한다. 결제 완료 webhook은 거래 상태와 결제 상태를 바꿀 수 있으므로 서명 검증이 필수이다. 현재 구현은 Toss webhook 요청의 raw body와 timestamp를 HMAC-SHA256으로 서명하고, header signature와 안전 비교한다. 서명이 맞지 않으면 결제 상태를 조회하거나 변경하기 전에 401로 거부한다. 서명 검증 후에도 webhook body의 amount를 그대로 신뢰하지 않고 DB payment amount와 비교한다. 이미 반영된 중복 webhook은 ignored로 처리해 idempotent하게 동작한다. 이 항목은 코드와 unit test 근거가 충분하며, 최종 보고서에는 실제 HTTP webhook 요청 캡처를 추가하면 된다.
