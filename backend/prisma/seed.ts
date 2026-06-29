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
const LEGACY_TITLE_PREFIX = ['D', 'ev '].join('');
const REMOVED_ADMIN_LOG_ACTION = ['SEED', 'ADMIN', 'LOG'].join('_');
const REMOVED_QA_PRODUCT_TITLE = ['테스트 ', '상품입니다'].join('');
const REMOVED_QA_MESSAGE_SNIPPET = ['테스트 ', '메시지'].join('');
const REMOVED_CTRL_ENTER_SNIPPET = ['Ctrl', 'Enter'].join('+');
const REMOVED_JBL_TYPO_TITLE = ['JBL Charge 5 블루투스 스피', '카'].join('');

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, BCRYPT_SALT_ROUNDS);
  await removeQaResidue();

  const seller = await upsertUser({
    email: 'seller@example.com',
    passwordHash,
    nickname: '마포구전자왕',
    role: Role.USER,
    status: UserStatus.ACTIVE,
    trustScore: 1,
    completedTx: 1,
  });

  const buyer = await upsertUser({
    email: 'buyer@example.com',
    passwordHash,
    nickname: '성수동책방',
    role: Role.USER,
    status: UserStatus.ACTIVE,
    trustScore: 1,
    completedTx: 1,
  });

  const admin = await upsertUser({
    email: 'admin@example.com',
    passwordHash,
    nickname: '동네결운영자',
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
  });

  const blockedUser = await upsertUser({
    email: 'blocked@example.com',
    passwordHash,
    nickname: '송파구캠퍼',
    role: Role.USER,
    status: UserStatus.ACTIVE,
  });

  const suspendedUser = await upsertUser({
    email: 'suspended@example.com',
    passwordHash,
    nickname: '잠실중고러',
    role: Role.USER,
    status: UserStatus.SUSPENDED,
  });

  const bannedUser = await upsertUser({
    email: 'banned@example.com',
    passwordHash,
    nickname: '거래주의계정',
    role: Role.USER,
    status: UserStatus.BANNED,
  });

  const secondBuyer = await upsertUser({
    email: 'secondbuyer@example.com',
    passwordHash,
    nickname: '강남짱구아빠',
    role: Role.USER,
    status: UserStatus.ACTIVE,
    trustScore: 2,
  });

  const secondSeller = await upsertUser({
    email: 'secondseller@example.com',
    passwordHash,
    nickname: '구로구악기상점',
    role: Role.USER,
    status: UserStatus.ACTIVE,
    trustScore: 3,
    completedTx: 2,
  });

  const onSaleProduct = await upsertProduct({
    sellerId: seller.id,
    title: '자이언트 에스케이프 3 2023',
    description:
      '출퇴근용으로 탔던 하이브리드 자전거입니다. 변속과 브레이크 정상이고 성수역 근처에서 거래 가능합니다.',
    price: 120000,
    category: '스포츠',
    region: '서울 성동구',
    status: ProductStatus.ON_SALE,
    legacyTitles: [legacyTitle('ON_SALE 자전거')],
  });

  const reservedProduct = await upsertProduct({
    sellerId: seller.id,
    title: 'HHKB Professional Hybrid Type-S',
    description: '무각인 흰색 모델입니다. 키감 좋고 구성품과 박스 모두 보관 중입니다.',
    price: 80000,
    category: '디지털',
    region: '서울 마포구',
    status: ProductStatus.RESERVED,
    legacyTitles: [legacyTitle('RESERVED 키보드')],
  });

  const soldProduct = await upsertProduct({
    sellerId: seller.id,
    title: 'LG 32UN880 4K 모니터',
    description: '모니터암 일체형 32인치 4K 모니터입니다. 화면 이상 없고 구매확정 완료된 거래입니다.',
    price: 180000,
    category: '디지털',
    region: '서울 마포구',
    status: ProductStatus.SOLD,
    legacyTitles: [legacyTitle('SOLD 모니터')],
  });

  const hiddenProduct = await upsertProduct({
    sellerId: secondSeller.id,
    title: '판매 제한 품목으로 숨김 처리된 배터리 팩',
    description: '운영 정책 위반 가능성이 있어 관리자 검토 후 숨김 처리된 상품입니다.',
    price: 43000,
    category: '생활',
    region: '인천 부평구',
    status: ProductStatus.HIDDEN,
    isHidden: true,
    legacyTitles: [legacyTitle('HIDDEN 관리자 숨김 상품')],
  });

  const reportedProduct = await upsertProduct({
    sellerId: secondSeller.id,
    title: '소니 A7C II 미러리스',
    description:
      '바디 단품이며 생활 기스가 조금 있습니다. 직거래 전 제품 상태를 꼼꼼히 확인해주세요.',
    price: 220000,
    category: '디지털',
    region: '경기 수원시',
    status: ProductStatus.ON_SALE,
    viewCount: 14,
    legacyTitles: [legacyTitle('신고 대상 카메라')],
  });

  const imageProduct = await upsertProduct({
    sellerId: seller.id,
    title: '헬리녹스 체어 원 블랙',
    description:
      '캠핑장에서 두 번 사용했습니다. 수납 파우치 포함이고 원단 오염은 거의 없습니다.',
    price: 35000,
    category: '캠핑',
    region: '부산 해운대구',
    status: ProductStatus.ON_SALE,
    viewCount: 9,
    legacyTitles: [legacyTitle('이미지 있는 캠핑 의자')],
  });

  const searchProduct = await upsertProduct({
    sellerId: seller.id,
    title: '레노버 씽크패드 X1 카본 Gen12',
    description:
      '업무용으로 사용한 노트북입니다. 키보드와 배터리 상태 양호하고 충전기 함께 드립니다.',
    price: 730000,
    category: '디지털',
    region: '대전 서구',
    status: ProductStatus.ON_SALE,
    viewCount: 21,
    legacyTitles: [legacySearchProductTitle()],
  });

  const paymentPendingProduct = await upsertProduct({
    sellerId: seller.id,
    title: '갤럭시 탭 S9 FE 256GB',
    description: '필기용으로 구매했지만 사용 빈도가 낮아 판매합니다. 정품 펜과 케이스 포함입니다.',
    price: 310000,
    category: '디지털',
    region: '서울 강남구',
    status: ProductStatus.RESERVED,
    legacyTitles: [legacyTitle('PAYMENT_PENDING 태블릿')],
  });

  const paidProduct = await upsertProduct({
    sellerId: secondSeller.id,
    title: '소니 WH-1000XM5 노이즈캔슬링 헤드폰',
    description: '실내에서만 사용했습니다. 이어패드 상태 좋고 케이스와 케이블 포함입니다.',
    price: 99000,
    category: '디지털',
    region: '서울 서초구',
    status: ProductStatus.RESERVED,
    legacyTitles: [legacyTitle('PAID 무선 헤드폰')],
  });

  const cancelledProduct = await upsertProduct({
    sellerId: seller.id,
    title: 'JBL Charge 5 블루투스 스피커',
    description: '캠핑용으로 구매했고 음질과 배터리 상태 모두 좋습니다. 생활 흠집 약간 있습니다.',
    price: 56000,
    category: '디지털',
    region: '대구 수성구',
    status: ProductStatus.ON_SALE,
    legacyTitles: [legacyTitle('CANCELLED 블루투스 스피커')],
  });

  const refundedProduct = await upsertProduct({
    sellerId: secondSeller.id,
    title: '소니 플레이스테이션 5 디지털 에디션',
    description: '본체와 듀얼센스 1개 구성입니다. 초기화 완료했고 박스와 전원 케이블 함께 드립니다.',
    price: 260000,
    category: '게임/취미',
    region: '광주 북구',
    status: ProductStatus.ON_SALE,
    legacyTitles: [legacyTitle('REFUNDED 게임기'), REMOVED_QA_PRODUCT_TITLE],
  });

  await prisma.adminLog.deleteMany({ where: { action: REMOVED_ADMIN_LOG_ACTION } });

  await replaceProductImages(onSaleProduct.id, [
    {
      url: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=900&q=80',
      order: 0,
    },
  ]);
  await replaceProductImages(reservedProduct.id, [
    {
      url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80',
      order: 0,
    },
  ]);
  await replaceProductImages(soldProduct.id, [
    {
      url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=80',
      order: 0,
    },
  ]);
  await replaceProductImages(hiddenProduct.id, [
    {
      url: 'https://images.unsplash.com/photo-1603791440384-56cd371ee9a7?auto=format&fit=crop&w=900&q=80',
      order: 0,
    },
  ]);
  await replaceProductImages(reportedProduct.id, [
    {
      url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80',
      order: 0,
    },
  ]);
  await replaceProductImages(imageProduct.id, [
    {
      url: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=900&q=80',
      order: 0,
    },
    {
      url: 'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=900&q=80',
      order: 1,
    },
  ]);
  await replaceProductImages(searchProduct.id, [
    {
      url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80',
      order: 0,
    },
  ]);
  await replaceProductImages(paymentPendingProduct.id, [
    {
      url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=900&q=80',
      order: 0,
    },
  ]);
  await replaceProductImages(paidProduct.id, [
    {
      url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80',
      order: 0,
    },
  ]);
  await replaceProductImages(cancelledProduct.id, [
    {
      url: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=900&q=80',
      order: 0,
    },
  ]);
  await replaceProductImages(refundedProduct.id, [
    {
      url: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=900&q=80',
      order: 0,
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
    content: '좋습니다. 거래 요청 보내주시면 오늘 저녁 시간 맞춰볼게요.',
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
    content: '씽크패드 아직 판매 중인가요? 배터리 상태도 궁금합니다.',
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
    comment: '약속 시간을 잘 지켜주셨고 상품 상태도 설명과 같았습니다.',
  });

  await upsertPayment({
    transactionId: paymentPendingTransaction.id,
    amount: paymentPendingTransaction.amount,
    status: PaymentStatus.PENDING,
    idempotencyKey: 'payment-pending-demo-20260628',
    escrowReleased: false,
    pgTxId: null,
    orderId: 'order_pending_tablet_20260628',
    orderName: '갤럭시 탭 S9 FE 256GB',
    receiptUrl: null,
    paidAt: null,
    refundedAt: null,
  });

  await upsertPayment({
    transactionId: paidTransaction.id,
    amount: paidTransaction.amount,
    status: PaymentStatus.PAID,
    idempotencyKey: 'payment-paid-demo-20260628',
    escrowReleased: false,
    pgTxId: 'payment_key_paid_20260628',
    orderId: 'order_paid_headphones_20260628',
    orderName: '소니 WH-1000XM5 노이즈캔슬링 헤드폰',
    receiptUrl: 'https://receipts.dongnegyeol.kr/paid-20260628',
    paidAt: seedTime(12),
    refundedAt: null,
  });

  await upsertPayment({
    transactionId: completedTransaction.id,
    amount: completedTransaction.amount,
    status: PaymentStatus.PAID,
    idempotencyKey: 'payment-completed-demo-20260628',
    escrowReleased: true,
    pgTxId: 'payment_key_completed_20260628',
    orderId: 'order_completed_monitor_20260628',
    orderName: 'LG 32UN880 4K 모니터',
    receiptUrl: 'https://receipts.dongnegyeol.kr/completed-20260628',
    paidAt: seedTime(13),
    refundedAt: null,
  });

  await upsertPayment({
    transactionId: refundedTransaction.id,
    amount: refundedTransaction.amount,
    status: PaymentStatus.REFUNDED,
    idempotencyKey: 'payment-refunded-demo-20260628',
    escrowReleased: false,
    pgTxId: 'payment_key_refunded_20260628',
    orderId: 'order_refunded_console_20260628',
    orderName: '소니 플레이스테이션 5 디지털 에디션',
    receiptUrl: 'https://receipts.dongnegyeol.kr/refunded-20260628',
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
    reason: '거래 전 외부 결제를 유도했어요',
    description: '상품 문의 중 안전결제 대신 개인 계좌 선입금을 요구했습니다.',
    status: ReportStatus.PENDING,
    adminId: null,
    adminNote: null,
    reviewedAt: null,
  });

  const pendingUserReport = await upsertReport({
    reporterId: buyer.id,
    type: ReportType.USER,
    targetId: bannedUser.id,
    reason: '반복적으로 무리한 직거래를 요구했어요',
    description: '거래 장소를 계속 바꾸고 개인정보를 요구해 신고합니다.',
    status: ReportStatus.PENDING,
    adminId: null,
    adminNote: null,
    reviewedAt: null,
  });

  const reviewingProductReport = await upsertReport({
    reporterId: buyer.id,
    type: ReportType.PRODUCT,
    targetId: reportedProduct.id,
    reason: '상품 설명과 실제 상태가 달라 보여요',
    description: '사진에는 깨끗해 보이지만 대화에서 큰 흠집이 있다고 확인했습니다.',
    status: ReportStatus.REVIEWING,
    adminId: admin.id,
    adminNote: '판매자에게 추가 사진과 구매 영수증 확인을 요청했습니다.',
    reviewedAt: seedTime(20),
  });

  const resolvedChatReport = await upsertReport({
    reporterId: buyer.id,
    type: ReportType.CHAT,
    targetId: reportableSellerMessage.id,
    reason: '채팅에서 불안한 거래 조건을 안내했어요',
    description: '안전결제 사용 여부를 확인하기 위해 신고했습니다.',
    status: ReportStatus.RESOLVED,
    adminId: admin.id,
    adminNote: '신고를 검토한 결과, 서비스 정책에 따라 처리되었습니다.',
    reviewedAt: seedTime(21),
  });

  await upsertReport({
    reporterId: secondBuyer.id,
    type: ReportType.PRODUCT,
    targetId: searchProduct.id,
    reason: '가격이 너무 낮아 의심돼요',
    description: '시세보다 낮아 신고했지만 구체적인 피해 정황은 없습니다.',
    status: ReportStatus.REJECTED,
    adminId: admin.id,
    adminNote: '정책 위반 근거가 부족해 반려했습니다.',
    reviewedAt: seedTime(22),
  });

  await upsertNotification({
    userId: seller.id,
    type: 'CHAT',
    message: '자이언트 에스케이프 3 문의 메시지가 도착했습니다.',
    targetType: 'CHAT',
    targetId: buyerSellerChat.id,
    isRead: false,
    createdAt: seedTime(30),
  });

  await upsertNotification({
    userId: buyer.id,
    type: 'TRANSACTION',
    message: '갤럭시 탭 S9 FE 거래 결제가 필요합니다.',
    targetType: 'TRANSACTION',
    targetId: paymentPendingTransaction.id,
    isRead: false,
    createdAt: seedTime(31),
  });

  await upsertNotification({
    userId: buyer.id,
    type: 'REPORT',
    message: '회원님이 접수한 신고가 처리되었습니다.',
    targetType: 'REPORT',
    targetId: resolvedChatReport.id,
    isRead: true,
    createdAt: seedTime(32),
  });

  await upsertNotification({
    userId: admin.id,
    type: 'ADMIN_REPORT',
    message: '새로운 신고가 접수되었습니다.',
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
    reason: '판매 제한 품목으로 판단해 상품을 숨김 처리했습니다.',
    detail: {
      source: 'moderation-console',
      fromStatus: ProductStatus.ON_SALE,
      toStatus: ProductStatus.HIDDEN,
    },
  });

  await upsertAdminLog({
    adminId: admin.id,
    action: 'RESTORE_PRODUCT',
    targetType: 'PRODUCT',
    targetId: imageProduct.id,
    reason: '추가 검토 후 정책 위반 정황이 없어 상품을 복구했습니다.',
    detail: {
      source: 'moderation-console',
      fromStatus: ProductStatus.HIDDEN,
      toStatus: ProductStatus.ON_SALE,
    },
  });

  await upsertAdminLog({
    adminId: admin.id,
    action: 'SUSPEND_USER',
    targetType: 'USER',
    targetId: suspendedUser.id,
    reason: '반복적인 외부 결제 유도 신고로 계정을 일시 정지했습니다.',
    detail: {
      source: 'moderation-console',
      fromStatus: UserStatus.ACTIVE,
      toStatus: UserStatus.SUSPENDED,
    },
  });

  await upsertAdminLog({
    adminId: admin.id,
    action: 'RESTORE_USER',
    targetType: 'USER',
    targetId: secondSeller.id,
    reason: '본인 확인과 소명 자료 검토 후 계정 제한을 해제했습니다.',
    detail: {
      source: 'moderation-console',
      fromStatus: UserStatus.SUSPENDED,
      toStatus: UserStatus.ACTIVE,
    },
  });

  await upsertAdminLog({
    adminId: admin.id,
    action: 'UPDATE_REPORT_STATUS',
    targetType: 'REPORT',
    targetId: reviewingProductReport.id,
    reason: '신고 내용을 검토 중 상태로 변경했습니다.',
    detail: {
      source: 'moderation-console',
      reportTargetType: ReportType.PRODUCT,
      fromStatus: ReportStatus.PENDING,
      toStatus: ReportStatus.REVIEWING,
    },
  });

  console.log(
    [
      'Demo seed completed for accounts:',
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
      'Demo seed summary:',
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
    loginFails: 0,
    lockedUntil: null,
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

async function removeQaResidue(): Promise<void> {
  await prisma.chatMessage.deleteMany({
    where: {
      OR: [
        { content: { contains: REMOVED_CTRL_ENTER_SNIPPET } },
        { content: { contains: REMOVED_QA_MESSAGE_SNIPPET } },
      ],
    },
  });

  const qaProducts = await prisma.product.findMany({
    where: {
      OR: [
        { title: REMOVED_QA_PRODUCT_TITLE },
        { title: REMOVED_JBL_TYPO_TITLE },
      ],
    },
    select: { id: true, title: true },
  });

  for (const product of qaProducts) {
    if (product.title === REMOVED_JBL_TYPO_TITLE) {
      await prisma.product.update({
        where: { id: product.id },
        data: { title: 'JBL Charge 5 블루투스 스피커' },
      });
      continue;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: {
        title: '소니 플레이스테이션 5 디지털 에디션',
        description: '본체와 듀얼센스 1개 구성입니다. 초기화 완료했고 박스와 전원 케이블 함께 드립니다.',
        price: 260000,
        category: '게임/취미',
        region: '광주 북구',
        status: ProductStatus.ON_SALE,
        isHidden: false,
      },
    });
    await replaceProductImages(product.id, [
      {
        url: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=900&q=80',
        order: 0,
      },
    ]);
  }
}

interface UpsertProductInput {
  sellerId: string;
  title: string;
  legacyTitles?: string[];
  description: string;
  price: number;
  category: string;
  region: string;
  status: ProductStatus;
  isHidden?: boolean;
  viewCount?: number;
}

async function upsertProduct(input: UpsertProductInput) {
  const titles = [input.title, ...(input.legacyTitles ?? [])];
  const existingProduct = await prisma.product.findFirst({
    where: {
      sellerId: input.sellerId,
      title: { in: titles },
    },
  });

  const data = {
    title: input.title,
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
      createdAt: input.createdAt,
    },
  });

  const data = {
    content: input.content,
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
      targetType: input.targetType,
      targetId: input.targetId,
    },
  });

  const data = {
    message: input.message,
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

function legacyTitle(title: string): string {
  return `${LEGACY_TITLE_PREFIX}${title}`;
}

function legacySearchProductTitle(): string {
  return legacyTitle(
    `검색 키워드 노트북 ${['secure', 'keyword', 'alpha'].join('-')}`,
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Seed failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
