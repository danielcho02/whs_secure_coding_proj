import * as bcrypt from 'bcrypt';
import {
  PaymentStatus,
  PrismaClient,
  ProductStatus,
  ReportStatus,
  ReportType,
  Role,
  TxStatus,
  UserStatus,
} from '@prisma/client';

const prisma = new PrismaClient();
const DEV_PASSWORD = 'Password123!';
const BCRYPT_SALT_ROUNDS = 10;
const SEED_BASE_TIME = new Date('2026-06-28T00:00:00.000Z');

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, BCRYPT_SALT_ROUNDS);

  const seller = await upsertUser({
    email: 'seller@example.com',
    passwordHash,
    nickname: 'dev-seller',
    role: Role.USER,
    status: UserStatus.ACTIVE,
    trustScore: 1,
    completedTx: 1,
  });

  const buyer = await upsertUser({
    email: 'buyer@example.com',
    passwordHash,
    nickname: 'dev-buyer',
    role: Role.USER,
    status: UserStatus.ACTIVE,
    trustScore: 1,
    completedTx: 1,
  });

  const admin = await upsertUser({
    email: 'admin@example.com',
    passwordHash,
    nickname: 'dev-admin',
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
  });

  const blockedUser = await upsertUser({
    email: 'blocked@example.com',
    passwordHash,
    nickname: 'dev-blocked',
    role: Role.USER,
    status: UserStatus.ACTIVE,
  });

  const suspendedUser = await upsertUser({
    email: 'suspended@example.com',
    passwordHash,
    nickname: 'dev-suspended',
    role: Role.USER,
    status: UserStatus.SUSPENDED,
  });

  const bannedUser = await upsertUser({
    email: 'banned@example.com',
    passwordHash,
    nickname: 'dev-banned',
    role: Role.USER,
    status: UserStatus.BANNED,
  });

  const secondBuyer = await upsertUser({
    email: 'secondbuyer@example.com',
    passwordHash,
    nickname: 'dev-second-buyer',
    role: Role.USER,
    status: UserStatus.ACTIVE,
    trustScore: 2,
  });

  const secondSeller = await upsertUser({
    email: 'secondseller@example.com',
    passwordHash,
    nickname: 'dev-second-seller',
    role: Role.USER,
    status: UserStatus.ACTIVE,
    trustScore: 3,
    completedTx: 2,
  });

  const onSaleProduct = await upsertProduct({
    sellerId: seller.id,
    title: 'Dev ON_SALE 자전거',
    description:
      '정상 기능 확인용 판매중 상품입니다. 검색 키워드: seed-bike commute.',
    price: 120000,
    category: '스포츠',
    region: '서울',
    status: ProductStatus.ON_SALE,
  });

  const reservedProduct = await upsertProduct({
    sellerId: seller.id,
    title: 'Dev RESERVED 키보드',
    description: '정상 기능 확인용 예약중 상품입니다.',
    price: 80000,
    category: '디지털',
    region: '서울',
    status: ProductStatus.RESERVED,
  });

  const soldProduct = await upsertProduct({
    sellerId: seller.id,
    title: 'Dev SOLD 모니터',
    description: '정상 기능 확인용 판매완료 상품입니다.',
    price: 180000,
    category: '디지털',
    region: '서울',
    status: ProductStatus.SOLD,
  });

  const hiddenProduct = await upsertProduct({
    sellerId: secondSeller.id,
    title: 'Dev HIDDEN 관리자 숨김 상품',
    description: '관리자 상품 숨김 상태 확인용 상품입니다.',
    price: 43000,
    category: '생활',
    region: '인천',
    status: ProductStatus.HIDDEN,
    isHidden: true,
  });

  const reportedProduct = await upsertProduct({
    sellerId: secondSeller.id,
    title: 'Dev 신고 대상 카메라',
    description:
      '관리자 신고 화면 확인용 상품입니다. 검색 키워드: seed-report-camera.',
    price: 220000,
    category: '디지털',
    region: '경기',
    status: ProductStatus.ON_SALE,
    viewCount: 14,
  });

  const imageProduct = await upsertProduct({
    sellerId: seller.id,
    title: 'Dev 이미지 있는 캠핑 의자',
    description:
      '이미지 렌더링 확인용 상품입니다. 검색 키워드: seed-image-chair.',
    price: 35000,
    category: '캠핑',
    region: '부산',
    status: ProductStatus.ON_SALE,
    viewCount: 9,
  });

  const searchProduct = await upsertProduct({
    sellerId: seller.id,
    title: 'Dev 검색 키워드 노트북 secure-keyword-alpha',
    description:
      '프론트 검색 화면 확인용 상품입니다. seed-search-laptop keyword 포함.',
    price: 730000,
    category: '디지털',
    region: '대전',
    status: ProductStatus.ON_SALE,
    viewCount: 21,
  });

  const paymentPendingProduct = await upsertProduct({
    sellerId: seller.id,
    title: 'Dev PAYMENT_PENDING 태블릿',
    description: '안전결제 결제대기 거래 화면 확인용 상품입니다.',
    price: 310000,
    category: '디지털',
    region: '서울',
    status: ProductStatus.RESERVED,
  });

  const paidProduct = await upsertProduct({
    sellerId: secondSeller.id,
    title: 'Dev PAID 무선 헤드폰',
    description: '결제완료 및 에스크로 미정산 상태 확인용 상품입니다.',
    price: 99000,
    category: '디지털',
    region: '서울',
    status: ProductStatus.RESERVED,
  });

  const cancelledProduct = await upsertProduct({
    sellerId: seller.id,
    title: 'Dev CANCELLED 블루투스 스피커',
    description: '취소 거래 목록 확인용 상품입니다.',
    price: 56000,
    category: '디지털',
    region: '대구',
    status: ProductStatus.ON_SALE,
  });

  const refundedProduct = await upsertProduct({
    sellerId: secondSeller.id,
    title: 'Dev REFUNDED 게임기',
    description: '환불 거래와 환불 결제 상태 확인용 상품입니다.',
    price: 260000,
    category: '게임',
    region: '광주',
    status: ProductStatus.ON_SALE,
  });

  await replaceProductImages(reportedProduct.id, [
    {
      url: 'https://placehold.co/800x600/webp?text=Dev+Camera',
      order: 0,
    },
  ]);
  await replaceProductImages(imageProduct.id, [
    {
      url: 'https://placehold.co/800x600/webp?text=Dev+Chair+Front',
      order: 0,
    },
    {
      url: 'https://placehold.co/800x600/webp?text=Dev+Chair+Detail',
      order: 1,
    },
  ]);

  const buyerSellerChat = await upsertChat({
    productId: onSaleProduct.id,
    buyerId: buyer.id,
    sellerId: seller.id,
  });

  await upsertChatMessage({
    chatId: buyerSellerChat.id,
    senderId: buyer.id,
    content: '안녕하세요. 아직 거래 가능할까요?',
    isRead: true,
    createdAt: seedTime(1),
  });
  await upsertChatMessage({
    chatId: buyerSellerChat.id,
    senderId: seller.id,
    content: '네, 가능합니다.',
    isRead: true,
    createdAt: seedTime(2),
  });
  await upsertChatMessage({
    chatId: buyerSellerChat.id,
    senderId: buyer.id,
    content: '오늘 저녁에 거래할 수 있을까요?',
    isRead: true,
    createdAt: seedTime(3),
  });
  const reportableSellerMessage = await upsertChatMessage({
    chatId: buyerSellerChat.id,
    senderId: seller.id,
    content: '좋습니다. 거래 요청 보내주세요. 신고 테스트 대상 메시지입니다.',
    isRead: false,
    createdAt: seedTime(4),
  });

  const secondBuyerChat = await upsertChat({
    productId: searchProduct.id,
    buyerId: secondBuyer.id,
    sellerId: seller.id,
  });

  await upsertChatMessage({
    chatId: secondBuyerChat.id,
    senderId: secondBuyer.id,
    content: 'secure-keyword-alpha 노트북 아직 판매 중인가요?',
    isRead: true,
    createdAt: seedTime(5),
  });
  await upsertChatMessage({
    chatId: secondBuyerChat.id,
    senderId: seller.id,
    content: '네, 배터리 상태도 좋습니다.',
    isRead: false,
    createdAt: seedTime(6),
  });

  await upsertTransaction({
    productId: onSaleProduct.id,
    buyerId: buyer.id,
    sellerId: seller.id,
    amount: onSaleProduct.price,
    status: TxStatus.REQUESTED,
  });

  await upsertTransaction({
    productId: reservedProduct.id,
    buyerId: buyer.id,
    sellerId: seller.id,
    amount: reservedProduct.price,
    status: TxStatus.RESERVED,
  });

  const paymentPendingTransaction = await upsertTransaction({
    productId: paymentPendingProduct.id,
    buyerId: buyer.id,
    sellerId: seller.id,
    amount: paymentPendingProduct.price,
    status: TxStatus.PAYMENT_PENDING,
  });

  const paidTransaction = await upsertTransaction({
    productId: paidProduct.id,
    buyerId: buyer.id,
    sellerId: secondSeller.id,
    amount: paidProduct.price,
    status: TxStatus.PAID,
  });

  const completedTransaction = await upsertTransaction({
    productId: soldProduct.id,
    buyerId: buyer.id,
    sellerId: seller.id,
    amount: soldProduct.price,
    status: TxStatus.COMPLETED,
  });

  await upsertTransaction({
    productId: cancelledProduct.id,
    buyerId: secondBuyer.id,
    sellerId: seller.id,
    amount: cancelledProduct.price,
    status: TxStatus.CANCELLED,
  });

  const refundedTransaction = await upsertTransaction({
    productId: refundedProduct.id,
    buyerId: buyer.id,
    sellerId: secondSeller.id,
    amount: refundedProduct.price,
    status: TxStatus.REFUNDED,
  });

  await upsertReview({
    transactionId: completedTransaction.id,
    authorId: buyer.id,
    targetId: seller.id,
    rating: 5,
    comment: '정상 기능 확인용 완료 거래 후기입니다.',
  });

  await upsertPayment({
    transactionId: paymentPendingTransaction.id,
    amount: paymentPendingTransaction.amount,
    status: PaymentStatus.PENDING,
    idempotencyKey: 'dev-seed-payment-pending',
    escrowReleased: false,
    pgTxId: null,
    orderId: 'dev_seed_order_pending',
    orderName: '[DEV] 결제대기 태블릿',
    receiptUrl: null,
    paidAt: null,
    refundedAt: null,
  });

  await upsertPayment({
    transactionId: paidTransaction.id,
    amount: paidTransaction.amount,
    status: PaymentStatus.PAID,
    idempotencyKey: 'dev-seed-payment-paid',
    escrowReleased: false,
    pgTxId: 'dev_seed_payment_key_paid',
    orderId: 'dev_seed_order_paid',
    orderName: '[DEV] 결제완료 무선 헤드폰',
    receiptUrl: 'https://example.com/dev-receipts/paid',
    paidAt: seedTime(12),
    refundedAt: null,
  });

  await upsertPayment({
    transactionId: completedTransaction.id,
    amount: completedTransaction.amount,
    status: PaymentStatus.PAID,
    idempotencyKey: 'dev-seed-payment-escrow-released',
    escrowReleased: true,
    pgTxId: 'dev_seed_payment_key_escrow_released',
    orderId: 'dev_seed_order_escrow_released',
    orderName: '[DEV] 구매확정 모니터',
    receiptUrl: 'https://example.com/dev-receipts/escrow-released',
    paidAt: seedTime(13),
    refundedAt: null,
  });

  await upsertPayment({
    transactionId: refundedTransaction.id,
    amount: refundedTransaction.amount,
    status: PaymentStatus.REFUNDED,
    idempotencyKey: 'dev-seed-payment-refunded',
    escrowReleased: false,
    pgTxId: 'dev_seed_payment_key_refunded',
    orderId: 'dev_seed_order_refunded',
    orderName: '[DEV] 환불완료 게임기',
    receiptUrl: 'https://example.com/dev-receipts/refunded',
    paidAt: seedTime(14),
    refundedAt: seedTime(18),
  });

  await prisma.block.upsert({
    where: {
      blockerId_blockedId: {
        blockerId: buyer.id,
        blockedId: blockedUser.id,
      },
    },
    update: {},
    create: {
      blockerId: buyer.id,
      blockedId: blockedUser.id,
    },
  });

  await prisma.block.upsert({
    where: {
      blockerId_blockedId: {
        blockerId: buyer.id,
        blockedId: bannedUser.id,
      },
    },
    update: {},
    create: {
      blockerId: buyer.id,
      blockedId: bannedUser.id,
    },
  });

  await prisma.block.upsert({
    where: {
      blockerId_blockedId: {
        blockerId: buyer.id,
        blockedId: secondBuyer.id,
      },
    },
    update: {},
    create: {
      blockerId: buyer.id,
      blockedId: secondBuyer.id,
    },
  });

  await upsertReport({
    reporterId: buyer.id,
    type: ReportType.PRODUCT,
    targetId: onSaleProduct.id,
    reason: '정상 기능 확인용 상품 신고',
    description: '관리자 PENDING 상품 신고 목록 확인용 seed 데이터입니다.',
    status: ReportStatus.PENDING,
    adminId: null,
    adminNote: null,
    reviewedAt: null,
  });

  const pendingUserReport = await upsertReport({
    reporterId: buyer.id,
    type: ReportType.USER,
    targetId: bannedUser.id,
    reason: '정상 기능 확인용 사용자 신고',
    description: '관리자 USER 신고 목록 확인용 seed 데이터입니다.',
    status: ReportStatus.PENDING,
    adminId: null,
    adminNote: null,
    reviewedAt: null,
  });

  const reviewingProductReport = await upsertReport({
    reporterId: buyer.id,
    type: ReportType.PRODUCT,
    targetId: reportedProduct.id,
    reason: '정상 기능 확인용 상품 신고',
    description: '관리자 PRODUCT 신고 검토중 상태 확인용 seed 데이터입니다.',
    status: ReportStatus.REVIEWING,
    adminId: admin.id,
    adminNote: '시연용 검토중 신고입니다.',
    reviewedAt: seedTime(20),
  });

  const resolvedChatReport = await upsertReport({
    reporterId: buyer.id,
    type: ReportType.CHAT,
    targetId: reportableSellerMessage.id,
    reason: '정상 기능 확인용 채팅 신고',
    description: 'CHAT 신고는 ChatMessage.id를 targetId로 사용합니다.',
    status: ReportStatus.RESOLVED,
    adminId: admin.id,
    adminNote: '시연용 처리 완료 신고입니다.',
    reviewedAt: seedTime(21),
  });

  await upsertReport({
    reporterId: secondBuyer.id,
    type: ReportType.PRODUCT,
    targetId: searchProduct.id,
    reason: '정상 기능 확인용 반려 신고',
    description: '관리자 REJECTED 신고 상태 확인용 seed 데이터입니다.',
    status: ReportStatus.REJECTED,
    adminId: admin.id,
    adminNote: '신고 사유가 충분하지 않은 시연용 데이터입니다.',
    reviewedAt: seedTime(22),
  });

  await upsertNotification({
    userId: seller.id,
    type: 'CHAT',
    message: '새 채팅 메시지가 도착했습니다.',
    targetType: 'CHAT',
    targetId: buyerSellerChat.id,
    isRead: false,
    createdAt: seedTime(30),
  });

  await upsertNotification({
    userId: buyer.id,
    type: 'TRANSACTION',
    message: '결제 대기 중인 거래가 있습니다.',
    targetType: 'TRANSACTION',
    targetId: paymentPendingTransaction.id,
    isRead: false,
    createdAt: seedTime(31),
  });

  await upsertNotification({
    userId: buyer.id,
    type: 'REPORT',
    message: '신고가 처리되었습니다.',
    targetType: 'REPORT',
    targetId: resolvedChatReport.id,
    isRead: true,
    createdAt: seedTime(32),
  });

  await upsertNotification({
    userId: admin.id,
    type: 'ADMIN_REPORT',
    message: '검토 대기 신고가 있습니다.',
    targetType: 'REPORT',
    targetId: pendingUserReport.id,
    isRead: false,
    createdAt: seedTime(33),
  });

  await upsertAdminLog({
    adminId: admin.id,
    action: 'HIDE_PRODUCT',
    targetType: 'PRODUCT',
    targetId: hiddenProduct.id,
    reason: 'seed 숨김 상품 시연 로그',
    detail: {
      source: 'db:seed',
      fromStatus: ProductStatus.ON_SALE,
      toStatus: ProductStatus.HIDDEN,
    },
  });

  await upsertAdminLog({
    adminId: admin.id,
    action: 'RESTORE_PRODUCT',
    targetType: 'PRODUCT',
    targetId: imageProduct.id,
    reason: 'seed 복구 상품 시연 로그',
    detail: {
      source: 'db:seed',
      fromStatus: ProductStatus.HIDDEN,
      toStatus: ProductStatus.ON_SALE,
    },
  });

  await upsertAdminLog({
    adminId: admin.id,
    action: 'SUSPEND_USER',
    targetType: 'USER',
    targetId: suspendedUser.id,
    reason: 'seed 정지 사용자 시연 로그',
    detail: {
      source: 'db:seed',
      fromStatus: UserStatus.ACTIVE,
      toStatus: UserStatus.SUSPENDED,
    },
  });

  await upsertAdminLog({
    adminId: admin.id,
    action: 'RESTORE_USER',
    targetType: 'USER',
    targetId: secondSeller.id,
    reason: 'seed 사용자 복구 시연 로그',
    detail: {
      source: 'db:seed',
      fromStatus: UserStatus.SUSPENDED,
      toStatus: UserStatus.ACTIVE,
    },
  });

  await upsertAdminLog({
    adminId: admin.id,
    action: 'UPDATE_REPORT_STATUS',
    targetType: 'REPORT',
    targetId: reviewingProductReport.id,
    reason: 'seed 신고 상태 변경 시연 로그',
    detail: {
      source: 'db:seed',
      reportTargetType: ReportType.PRODUCT,
      fromStatus: ReportStatus.PENDING,
      toStatus: ReportStatus.REVIEWING,
    },
  });

  await upsertAdminLog({
    adminId: admin.id,
    action: 'SEED_ADMIN_LOG',
    targetType: 'PRODUCT',
    targetId: onSaleProduct.id,
    reason: 'seed 확인용 로그',
    detail: { source: 'db:seed' },
  });

  console.log(
    [
      'Dev seed completed for accounts:',
      'seller@example.com',
      'buyer@example.com',
      'admin@example.com',
      'suspended@example.com',
      'banned@example.com',
      'secondbuyer@example.com',
      'secondseller@example.com',
    ].join(' '),
  );
  console.log(
    [
      'Dev seed summary:',
      'users=8',
      'products=11',
      'chats=2',
      'transactions=7',
      'payments=4',
      'reports=5',
      'blocks=3',
      'notifications=4',
      'adminLogs=6',
    ].join(' '),
  );
}

interface UpsertUserInput {
  email: string;
  passwordHash: string;
  nickname: string;
  role: Role;
  status: UserStatus;
  trustScore?: number;
  completedTx?: number;
}

async function upsertUser(input: UpsertUserInput) {
  const data = {
    passwordHash: input.passwordHash,
    nickname: input.nickname,
    role: input.role,
    status: input.status,
    trustScore: input.trustScore ?? 0,
    completedTx: input.completedTx ?? 0,
  };

  return prisma.user.upsert({
    where: { email: input.email },
    update: data,
    create: {
      email: input.email,
      ...data,
    },
  });
}

interface UpsertProductInput {
  sellerId: string;
  title: string;
  description: string;
  price: number;
  category: string;
  region: string;
  status: ProductStatus;
  isHidden?: boolean;
  viewCount?: number;
}

async function upsertProduct(input: UpsertProductInput) {
  const existingProduct = await prisma.product.findFirst({
    where: {
      sellerId: input.sellerId,
      title: input.title,
    },
  });

  const data = {
    description: input.description,
    price: input.price,
    category: input.category,
    region: input.region,
    status: input.status,
    isHidden: input.isHidden ?? false,
    viewCount: input.viewCount ?? 0,
  };

  if (existingProduct) {
    return prisma.product.update({
      where: { id: existingProduct.id },
      data,
    });
  }

  return prisma.product.create({
    data: {
      sellerId: input.sellerId,
      title: input.title,
      ...data,
    },
  });
}

interface ProductImageSeed {
  url: string;
  order: number;
}

async function replaceProductImages(
  productId: string,
  images: ProductImageSeed[],
): Promise<void> {
  await prisma.productImage.deleteMany({ where: { productId } });

  if (images.length === 0) {
    return;
  }

  await prisma.productImage.createMany({
    data: images.map((image) => ({
      productId,
      url: image.url,
      order: image.order,
    })),
  });
}

interface UpsertChatInput {
  productId: string;
  buyerId: string;
  sellerId: string;
}

async function upsertChat(input: UpsertChatInput) {
  return prisma.chat.upsert({
    where: {
      productId_buyerId: {
        productId: input.productId,
        buyerId: input.buyerId,
      },
    },
    update: {
      sellerId: input.sellerId,
    },
    create: input,
  });
}

interface UpsertChatMessageInput {
  chatId: string;
  senderId: string;
  content: string;
  imageUrl?: string | null;
  isRead: boolean;
  createdAt: Date;
}

async function upsertChatMessage(input: UpsertChatMessageInput) {
  const existingMessage = await prisma.chatMessage.findFirst({
    where: {
      chatId: input.chatId,
      senderId: input.senderId,
      content: input.content,
    },
  });

  const data = {
    imageUrl: input.imageUrl ?? null,
    isRead: input.isRead,
    createdAt: input.createdAt,
  };

  if (existingMessage) {
    return prisma.chatMessage.update({
      where: { id: existingMessage.id },
      data,
    });
  }

  return prisma.chatMessage.create({
    data: {
      chatId: input.chatId,
      senderId: input.senderId,
      content: input.content,
      ...data,
    },
  });
}

interface UpsertTransactionInput {
  productId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  status: TxStatus;
}

async function upsertTransaction(input: UpsertTransactionInput) {
  const existingTransaction = await prisma.transaction.findFirst({
    where: {
      productId: input.productId,
      buyerId: input.buyerId,
      sellerId: input.sellerId,
    },
  });

  if (existingTransaction) {
    return prisma.transaction.update({
      where: { id: existingTransaction.id },
      data: {
        amount: input.amount,
        status: input.status,
      },
    });
  }

  return prisma.transaction.create({
    data: input,
  });
}

interface UpsertPaymentInput {
  transactionId: string;
  amount: number;
  status: PaymentStatus;
  idempotencyKey: string;
  escrowReleased: boolean;
  pgTxId: string | null;
  orderId: string;
  orderName: string;
  receiptUrl: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;
}

async function upsertPayment(input: UpsertPaymentInput) {
  const data = {
    amount: input.amount,
    status: input.status,
    idempotencyKey: input.idempotencyKey,
    escrowReleased: input.escrowReleased,
    pgTxId: input.pgTxId,
    orderId: input.orderId,
    orderName: input.orderName,
    receiptUrl: input.receiptUrl,
    paidAt: input.paidAt,
    refundedAt: input.refundedAt,
  };

  return prisma.payment.upsert({
    where: { transactionId: input.transactionId },
    update: data,
    create: {
      transactionId: input.transactionId,
      ...data,
    },
  });
}

interface UpsertReviewInput {
  transactionId: string;
  authorId: string;
  targetId: string;
  rating: number;
  comment: string;
}

async function upsertReview(input: UpsertReviewInput): Promise<void> {
  const existingReview = await prisma.review.findFirst({
    where: {
      transactionId: input.transactionId,
      authorId: input.authorId,
    },
  });

  const data = {
    targetId: input.targetId,
    rating: input.rating,
    comment: input.comment,
  };

  if (existingReview) {
    await prisma.review.update({
      where: { id: existingReview.id },
      data,
    });
    return;
  }

  await prisma.review.create({
    data: {
      transactionId: input.transactionId,
      authorId: input.authorId,
      ...data,
    },
  });
}

interface UpsertReportInput {
  reporterId: string;
  type: ReportType;
  targetId: string;
  reason: string;
  description: string | null;
  status: ReportStatus;
  adminId: string | null;
  adminNote: string | null;
  reviewedAt: Date | null;
}

async function upsertReport(input: UpsertReportInput) {
  const data = {
    reason: input.reason,
    description: input.description,
    status: input.status,
    adminId: input.adminId,
    adminNote: input.adminNote,
    reviewedAt: input.reviewedAt,
  };

  return prisma.report.upsert({
    where: {
      reporterId_type_targetId: {
        reporterId: input.reporterId,
        type: input.type,
        targetId: input.targetId,
      },
    },
    update: data,
    create: {
      reporterId: input.reporterId,
      type: input.type,
      targetId: input.targetId,
      ...data,
    },
  });
}

interface UpsertNotificationInput {
  userId: string;
  type: string;
  message: string;
  targetType: string | null;
  targetId: string | null;
  isRead: boolean;
  createdAt: Date;
}

async function upsertNotification(
  input: UpsertNotificationInput,
): Promise<void> {
  const existingNotification = await prisma.notification.findFirst({
    where: {
      userId: input.userId,
      type: input.type,
      message: input.message,
      targetType: input.targetType,
      targetId: input.targetId,
    },
  });

  const data = {
    isRead: input.isRead,
    createdAt: input.createdAt,
  };

  if (existingNotification) {
    await prisma.notification.update({
      where: { id: existingNotification.id },
      data,
    });
    return;
  }

  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      message: input.message,
      targetType: input.targetType,
      targetId: input.targetId,
      ...data,
    },
  });
}

interface UpsertAdminLogInput {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  detail: Record<string, string>;
}

async function upsertAdminLog(input: UpsertAdminLogInput): Promise<void> {
  const existingAdminLog = await prisma.adminLog.findFirst({
    where: {
      adminId: input.adminId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
    },
  });

  const data = {
    reason: input.reason,
    detail: JSON.stringify(input.detail),
  };

  if (existingAdminLog) {
    await prisma.adminLog.update({
      where: { id: existingAdminLog.id },
      data,
    });
    return;
  }

  await prisma.adminLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      ...data,
    },
  });
}

function seedTime(minutes: number): Date {
  return new Date(SEED_BASE_TIME.getTime() + minutes * 60 * 1000);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Dev seed failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
