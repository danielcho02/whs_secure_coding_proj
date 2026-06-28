# 데이터베이스 설계 (Database Design)

DB: PostgreSQL / ORM: Prisma. 모든 쿼리는 Prisma를 통해 Prepared Statement로 실행되어 SQL Injection을 차단한다(SR-12). 다만 취약점 시연을 위해 `$queryRawUnsafe`로 의도적 취약 엔드포인트를 별도로 둘 수 있다(보안 문서 참고).

---

## 1. ERD (관계도)

```
users ─1:N─ products ─1:N─ product_images
  │            │
  │            ├─1:N─ favorites ─N:1─ users
  │            └─1:N─ transactions ─1:1─ payments
  │                       │
  │                       └─1:N─ reviews
  │
  ├─1:N─ chats(buyer/seller) ─1:N─ chat_messages
  ├─1:N─ blocks
  ├─1:N─ reports
  ├─1:N─ notifications
  ├─1:N─ admin_logs (admin)
  └─1:N─ audit_logs
```

핵심 관계:
- users 1:N products / chat_messages / reports
- products 1:N product_images / transactions
- chats 1:N chat_messages
- transactions 1:1 payments, 1:N reviews

---

## 2. Prisma 스키마 (`schema.prisma`)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

// ── 사용자 ──────────────────────────────
enum UserStatus { ACTIVE SUSPENDED BANNED WITHDRAWN }
enum Role       { USER ADMIN }

model User {
  id           String     @id @default(uuid())
  email        String     @unique
  passwordHash String                       // bcrypt/Argon2 (SR-01)
  nickname     String     @unique
  bio          String?
  avatarUrl    String?
  phone        String?                      // 최소 노출 (SR-29)
  role         Role       @default(USER)    // 클라가 못 바꿈 (SR-15)
  status       UserStatus @default(ACTIVE)
  trustScore   Int        @default(0)
  completedTx  Int        @default(0)
  loginFails   Int        @default(0)       // SR-02 보조
  lockedUntil  DateTime?
  createdAt    DateTime   @default(now())

  products      Product[]
  favorites     Favorite[]
  buyerChats    Chat[]        @relation("buyer")
  sellerChats   Chat[]        @relation("seller")
  messages      ChatMessage[]
  buyerTx       Transaction[] @relation("buyer")
  sellerTx      Transaction[] @relation("seller")
  reviewsWritten Review[]     @relation("author")
  reviewsGot    Review[]      @relation("target")
  reports       Report[]
  notifications Notification[]
  blocksMade    Block[]       @relation("blocker")
  blocksGot     Block[]       @relation("blocked")
}

// ── 상품 ────────────────────────────────
enum ProductStatus { ON_SALE RESERVED SOLD HIDDEN }

model Product {
  id          String        @id @default(uuid())
  sellerId    String
  seller      User          @relation(fields: [sellerId], references: [id])
  title       String
  description String                          // 출력 시 escape (SR-13)
  price       Int                             // 결제 기준 (SR-22)
  category    String
  region      String?
  status      ProductStatus @default(ON_SALE)
  viewCount   Int           @default(0)
  isHidden    Boolean       @default(false)   // 관리자 숨김 (FR-44)
  createdAt   DateTime      @default(now())

  images       ProductImage[]
  favorites    Favorite[]
  transactions Transaction[]
  @@index([category]) @@index([price]) @@index([createdAt])
}

model ProductImage {
  id        String  @id @default(uuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  url       String                            // UUID 파일명 (SR-19)
  order     Int     @default(0)
}

model Favorite {
  id        String  @id @default(uuid())
  userId    String
  productId String
  user      User    @relation(fields: [userId], references: [id])
  product   Product @relation(fields: [productId], references: [id])
  @@unique([userId, productId])
}

// ── 채팅 ────────────────────────────────
model Chat {
  id        String        @id @default(uuid())
  productId String
  buyerId   String
  sellerId  String
  buyer     User          @relation("buyer",  fields: [buyerId],  references: [id])
  seller    User          @relation("seller", fields: [sellerId], references: [id])
  createdAt DateTime      @default(now())
  messages  ChatMessage[]
  @@unique([productId, buyerId])              // 상품당 구매자별 1방
}

model ChatMessage {
  id        String   @id @default(uuid())
  chatId    String
  senderId  String
  chat      Chat     @relation(fields: [chatId], references: [id], onDelete: Cascade)
  sender    User     @relation(fields: [senderId], references: [id])
  content   String                            // escape (SR-13)
  imageUrl  String?
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())
  @@index([chatId, createdAt])
}

model Block {
  id        String @id @default(uuid())
  blockerId String
  blockedId String
  blocker   User   @relation("blocker", fields: [blockerId], references: [id])
  blocked   User   @relation("blocked", fields: [blockedId], references: [id])
  @@unique([blockerId, blockedId])
}

// ── 거래 ────────────────────────────────
enum TxStatus {
  REQUESTED RESERVED PAYMENT_PENDING PAID
  SHIPPING COMPLETED CANCELLED REFUNDED
}

model Transaction {
  id         String   @id @default(uuid())
  productId  String
  buyerId    String
  sellerId   String
  product    Product  @relation(fields: [productId], references: [id])
  buyer      User     @relation("buyer",  fields: [buyerId],  references: [id])
  seller     User     @relation("seller", fields: [sellerId], references: [id])
  status     TxStatus @default(REQUESTED)
  amount     Int                              // 서버 계산값 저장 (SR-22)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  payment    Payment?
  reviews    Review[]
  @@index([buyerId]) @@index([sellerId])
}

// ── 결제 ────────────────────────────────
enum PaymentStatus { PENDING PAID FAILED CANCELED REFUND_REQUESTED REFUNDED }

model Payment {
  id             String        @id @default(uuid())
  transactionId  String        @unique
  transaction    Transaction   @relation(fields: [transactionId], references: [id])
  amount         Int                          // 서버 기준 (SR-22)
  status         PaymentStatus @default(PENDING)
  idempotencyKey String        @unique        // 중복 결제 차단 (SR-24)
  escrowReleased Boolean       @default(false) // 구매확정 후 true (SR-27)
  pgTxId         String?                      // Toss paymentKey
  orderId        String        @unique
  orderName      String
  receiptUrl     String?
  paidAt         DateTime?
  refundedAt     DateTime?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
}

// ── 후기 ────────────────────────────────
model Review {
  id            String      @id @default(uuid())
  transactionId String
  authorId      String
  targetId      String
  transaction   Transaction @relation(fields: [transactionId], references: [id])
  author        User        @relation("author", fields: [authorId], references: [id])
  target        User        @relation("target", fields: [targetId], references: [id])
  rating        Int                            // 1~5, 서버 범위 검증 (SR-14)
  comment       String?
  createdAt     DateTime    @default(now())
}

// ── 신고 ────────────────────────────────
enum ReportType   { PRODUCT USER CHAT }
enum ReportStatus { PENDING REVIEWING RESOLVED REJECTED }

model Report {
  id          String       @id @default(uuid())
  reporterId  String
  reporter    User         @relation(fields: [reporterId], references: [id])
  adminId     String?
  admin       User?        @relation(fields: [adminId], references: [id])
  type        ReportType
  targetId    String                           // 신고 대상 객체 id
  reason      String
  description String?
  status      ReportStatus @default(PENDING)
  adminNote   String?
  reviewedAt  DateTime?
  createdAt   DateTime     @default(now())
  @@unique([reporterId, type, targetId])       // 중복 신고 방지
  @@index([status]) @@index([type]) @@index([adminId])
}

// ── 알림 ────────────────────────────────
model Notification {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String                             // CHAT, TX, REPORT, FAVORITE
  message   String                             // 민감정보 과다 노출 금지 (SR-39)
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())
  @@index([userId, isRead])
}

// ── 관리자/감사 로그 ────────────────────
model AdminLog {
  id        String   @id @default(uuid())
  adminId   String
  admin     User     @relation(fields: [adminId], references: [id])
  action    String                             // SUSPEND_USER, HIDE_PRODUCT...
  targetType String                            // REPORT, PRODUCT, USER...
  targetId  String
  reason    String?
  detail    String?
  createdAt DateTime @default(now())            // append-only (SR-28)
  @@index([adminId]) @@index([action]) @@index([targetType, targetId])
}

model AuditLog {
  id        String   @id @default(uuid())
  userId    String?
  event     String                             // LOGIN, PAYMENT, REFUND...
  ip        String?
  detail    String?                            // 비번/토큰/계좌 저장 금지 (SR-31)
  createdAt DateTime @default(now())
}
```

---

## 3. 동시성/무결성 메모

- **Race Condition (중복 판매)**: `Transaction` 생성·`Product.status` 전이는 트랜잭션 + 행 잠금(`SELECT ... FOR UPDATE`, Prisma `$transaction` + 비관적 락 패턴 또는 status 조건부 update)으로 보호한다(SR-24 관련).
  ```sql
  UPDATE products SET status='RESERVED'
   WHERE id = $1 AND status = 'ON_SALE';   -- affected rows=0이면 이미 선점
  ```
- **Idempotency**: `Payment.idempotencyKey` UNIQUE 제약으로 중복 결제 요청을 DB 레벨에서 차단.
- **Toss 추적성**: `Payment.orderId`는 Toss checkout/confirm 대조용 UNIQUE 값, `pgTxId`는 Toss `paymentKey` 저장용으로 사용한다.
- **중복 신고 방지**: `Report @@unique([reporterId, type, targetId])`로 같은 사용자가 같은 USER/PRODUCT를 반복 신고하지 못하게 하고 API는 409를 반환한다.
- **관리자 로그**: `AdminLog`는 append-only로 사용한다. 수정/삭제 API를 만들지 않고, 응답은 `adminId/action/targetType/targetId/reason/createdAt` 중심으로 민감정보를 제외한다.
- **탈퇴 마스킹(SR-33)**: 사용자 `status=WITHDRAWN` 시 email/phone/nickname을 마스킹 값으로 치환하거나 분리 보관.
