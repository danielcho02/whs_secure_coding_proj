import * as bcrypt from 'bcrypt';
import {
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

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, BCRYPT_SALT_ROUNDS);

  const seller = await prisma.user.upsert({
    where: { email: 'seller@example.com' },
    update: {
      passwordHash,
      nickname: 'dev-seller',
      role: Role.USER,
      status: UserStatus.ACTIVE,
      trustScore: 1,
      completedTx: 1,
    },
    create: {
      email: 'seller@example.com',
      passwordHash,
      nickname: 'dev-seller',
      role: Role.USER,
      status: UserStatus.ACTIVE,
      trustScore: 1,
      completedTx: 1,
    },
  });

  const buyer = await prisma.user.upsert({
    where: { email: 'buyer@example.com' },
    update: {
      passwordHash,
      nickname: 'dev-buyer',
      role: Role.USER,
      status: UserStatus.ACTIVE,
      trustScore: 1,
      completedTx: 1,
    },
    create: {
      email: 'buyer@example.com',
      passwordHash,
      nickname: 'dev-buyer',
      role: Role.USER,
      status: UserStatus.ACTIVE,
      trustScore: 1,
      completedTx: 1,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      passwordHash,
      nickname: 'dev-admin',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: 'admin@example.com',
      passwordHash,
      nickname: 'dev-admin',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const blockedUser = await prisma.user.upsert({
    where: { email: 'blocked@example.com' },
    update: {
      passwordHash,
      nickname: 'dev-blocked',
      role: Role.USER,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: 'blocked@example.com',
      passwordHash,
      nickname: 'dev-blocked',
      role: Role.USER,
      status: UserStatus.ACTIVE,
    },
  });

  const onSaleProduct = await upsertProduct({
    sellerId: seller.id,
    title: 'Dev ON_SALE 자전거',
    description: '정상 기능 확인용 판매중 상품입니다.',
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

  const chat = await prisma.chat.upsert({
    where: {
      productId_buyerId: {
        productId: onSaleProduct.id,
        buyerId: buyer.id,
      },
    },
    update: {
      sellerId: seller.id,
    },
    create: {
      productId: onSaleProduct.id,
      buyerId: buyer.id,
      sellerId: seller.id,
    },
  });

  await prisma.chatMessage.deleteMany({ where: { chatId: chat.id } });
  await prisma.chatMessage.createMany({
    data: [
      {
        chatId: chat.id,
        senderId: buyer.id,
        content: '안녕하세요. 아직 거래 가능할까요?',
      },
      {
        chatId: chat.id,
        senderId: seller.id,
        content: '네, 가능합니다.',
      },
      {
        chatId: chat.id,
        senderId: buyer.id,
        content: '오늘 저녁에 거래할 수 있을까요?',
      },
      {
        chatId: chat.id,
        senderId: seller.id,
        content: '좋습니다. 거래 요청 보내주세요.',
      },
    ],
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

  const completedTransaction = await upsertTransaction({
    productId: soldProduct.id,
    buyerId: buyer.id,
    sellerId: seller.id,
    amount: soldProduct.price,
    status: TxStatus.COMPLETED,
  });

  const existingReview = await prisma.review.findFirst({
    where: {
      transactionId: completedTransaction.id,
      authorId: buyer.id,
    },
  });

  if (existingReview) {
    await prisma.review.update({
      where: { id: existingReview.id },
      data: {
        targetId: seller.id,
        rating: 5,
        comment: '정상 기능 확인용 완료 거래 후기입니다.',
      },
    });
  } else {
    await prisma.review.create({
      data: {
        transactionId: completedTransaction.id,
        authorId: buyer.id,
        targetId: seller.id,
        rating: 5,
        comment: '정상 기능 확인용 완료 거래 후기입니다.',
      },
    });
  }

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

  await prisma.report.upsert({
    where: {
      reporterId_type_targetId: {
        reporterId: buyer.id,
        type: ReportType.PRODUCT,
        targetId: onSaleProduct.id,
      },
    },
    update: {
      reason: '정상 기능 확인용 상품 신고',
      description: '관리자 신고 목록 확인용 seed 데이터입니다.',
      status: ReportStatus.PENDING,
      adminId: null,
      adminNote: null,
      reviewedAt: null,
    },
    create: {
      reporterId: buyer.id,
      type: ReportType.PRODUCT,
      targetId: onSaleProduct.id,
      reason: '정상 기능 확인용 상품 신고',
      description: '관리자 신고 목록 확인용 seed 데이터입니다.',
      status: ReportStatus.PENDING,
    },
  });

  const existingAdminLog = await prisma.adminLog.findFirst({
    where: {
      adminId: admin.id,
      action: 'SEED_ADMIN_LOG',
      targetType: 'PRODUCT',
      targetId: onSaleProduct.id,
    },
  });

  if (existingAdminLog) {
    await prisma.adminLog.update({
      where: { id: existingAdminLog.id },
      data: {
        reason: 'seed 확인용 로그',
        detail: JSON.stringify({ source: 'db:seed' }),
      },
    });
  } else {
    await prisma.adminLog.create({
      data: {
        adminId: admin.id,
        action: 'SEED_ADMIN_LOG',
        targetType: 'PRODUCT',
        targetId: onSaleProduct.id,
        reason: 'seed 확인용 로그',
        detail: JSON.stringify({ source: 'db:seed' }),
      },
    });
  }

  console.log(
    'Dev seed completed for seller@example.com, buyer@example.com, admin@example.com',
  );
}

interface UpsertProductInput {
  sellerId: string;
  title: string;
  description: string;
  price: number;
  category: string;
  region: string;
  status: ProductStatus;
}

async function upsertProduct(input: UpsertProductInput) {
  const existingProduct = await prisma.product.findFirst({
    where: {
      sellerId: input.sellerId,
      title: input.title,
    },
  });

  if (existingProduct) {
    return prisma.product.update({
      where: { id: existingProduct.id },
      data: {
        description: input.description,
        price: input.price,
        category: input.category,
        region: input.region,
        status: input.status,
        isHidden: false,
      },
    });
  }

  return prisma.product.create({
    data: {
      sellerId: input.sellerId,
      title: input.title,
      description: input.description,
      price: input.price,
      category: input.category,
      region: input.region,
      status: input.status,
      isHidden: false,
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

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Dev seed failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
