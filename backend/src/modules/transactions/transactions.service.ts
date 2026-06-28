import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus, TxStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import {
  PaginatedTransactionsResponse,
  ReviewResponse,
  TransactionResponse,
} from './dto/transaction-response.dto';

const PUBLIC_USER_SELECT = {
  id: true,
  nickname: true,
  avatarUrl: true,
  trustScore: true,
  completedTx: true,
} satisfies Prisma.UserSelect;

const PRODUCT_FOR_TRANSACTION_SELECT = {
  id: true,
  sellerId: true,
  price: true,
  status: true,
  isHidden: true,
} satisfies Prisma.ProductSelect;

const PRODUCT_SUMMARY_SELECT = {
  id: true,
  title: true,
  price: true,
  status: true,
  images: {
    select: {
      url: true,
      order: true,
    },
    orderBy: { order: 'asc' },
    take: 1,
  },
} satisfies Prisma.ProductSelect;

const TRANSACTION_STATE_SELECT = {
  id: true,
  productId: true,
  buyerId: true,
  sellerId: true,
  status: true,
} satisfies Prisma.TransactionSelect;

const TRANSACTION_RESPONSE_SELECT = {
  id: true,
  status: true,
  amount: true,
  createdAt: true,
  updatedAt: true,
  product: {
    select: PRODUCT_SUMMARY_SELECT,
  },
  buyer: {
    select: PUBLIC_USER_SELECT,
  },
  seller: {
    select: PUBLIC_USER_SELECT,
  },
} satisfies Prisma.TransactionSelect;

const REVIEW_RESPONSE_SELECT = {
  id: true,
  transactionId: true,
  rating: true,
  comment: true,
  createdAt: true,
  author: {
    select: PUBLIC_USER_SELECT,
  },
  target: {
    select: PUBLIC_USER_SELECT,
  },
} satisfies Prisma.ReviewSelect;

const ACTIVE_TRANSACTION_STATUSES = [
  TxStatus.REQUESTED,
  TxStatus.RESERVED,
  TxStatus.PAYMENT_PENDING,
  TxStatus.PAID,
  TxStatus.SHIPPING,
] as const;

const PRODUCT_OCCUPYING_TRANSACTION_STATUSES = [
  TxStatus.RESERVED,
  TxStatus.PAYMENT_PENDING,
  TxStatus.PAID,
  TxStatus.SHIPPING,
  TxStatus.COMPLETED,
] as const;

const CANCELLABLE_STATUSES = [
  TxStatus.REQUESTED,
  TxStatus.RESERVED,
  TxStatus.PAYMENT_PENDING,
] as const;

const COMPLETABLE_STATUSES = [TxStatus.RESERVED, TxStatus.SHIPPING] as const;

type ProductForTransaction = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_FOR_TRANSACTION_SELECT;
}>;
type TransactionState = Prisma.TransactionGetPayload<{
  select: typeof TRANSACTION_STATE_SELECT;
}>;
type TransactionRecord = Prisma.TransactionGetPayload<{
  select: typeof TRANSACTION_RESPONSE_SELECT;
}>;
type ReviewRecord = Prisma.ReviewGetPayload<{
  select: typeof REVIEW_RESPONSE_SELECT;
}>;

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async createTransaction(
    buyerId: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionResponse> {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, isHidden: false },
      select: PRODUCT_FOR_TRANSACTION_SELECT,
    });

    this.assertProductRequestable(product, buyerId);

    const existingActiveTransaction = await this.prisma.transaction.findFirst({
      where: {
        productId: dto.productId,
        buyerId,
        status: { in: [...ACTIVE_TRANSACTION_STATUSES] },
      },
      select: { id: true },
    });

    if (existingActiveTransaction) {
      throw new ConflictException('Active transaction already exists');
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        productId: product.id,
        buyerId,
        sellerId: product.sellerId,
        amount: product.price,
        status: TxStatus.REQUESTED,
      },
      select: TRANSACTION_RESPONSE_SELECT,
    });

    return this.toTransactionResponse(transaction);
  }

  async reserveTransaction(
    transactionId: string,
    sellerId: string,
  ): Promise<TransactionResponse> {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
        select: TRANSACTION_STATE_SELECT,
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      this.assertSeller(transaction, sellerId);

      if (transaction.status !== TxStatus.REQUESTED) {
        throw new BadRequestException('Transaction cannot be reserved');
      }

      const occupyingTransaction = await tx.transaction.findFirst({
        where: {
          productId: transaction.productId,
          id: { not: transaction.id },
          status: { in: [...PRODUCT_OCCUPYING_TRANSACTION_STATUSES] },
        },
        select: { id: true },
      });

      if (occupyingTransaction) {
        throw new ConflictException('Product is already reserved or sold');
      }

      const productUpdate = await tx.product.updateMany({
        where: {
          id: transaction.productId,
          isHidden: false,
          status: ProductStatus.ON_SALE,
        },
        data: { status: ProductStatus.RESERVED },
      });

      if (productUpdate.count !== 1) {
        throw new ConflictException('Product is not available');
      }

      const transactionUpdate = await tx.transaction.updateMany({
        where: { id: transaction.id, status: TxStatus.REQUESTED },
        data: { status: TxStatus.RESERVED },
      });

      if (transactionUpdate.count !== 1) {
        throw new ConflictException('Transaction state changed');
      }

      return this.findTransactionResponseOrThrow(tx, transaction.id);
    });
  }

  async cancelTransaction(
    transactionId: string,
    userId: string,
  ): Promise<TransactionResponse> {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
        select: TRANSACTION_STATE_SELECT,
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      this.assertParticipant(transaction, userId);

      if (!this.isCancellableStatus(transaction.status)) {
        throw new BadRequestException('Transaction cannot be cancelled');
      }

      if (this.shouldRestoreProductOnCancel(transaction.status)) {
        const productUpdate = await tx.product.updateMany({
          where: {
            id: transaction.productId,
            status: ProductStatus.RESERVED,
          },
          data: { status: ProductStatus.ON_SALE },
        });

        if (productUpdate.count !== 1) {
          throw new ConflictException('Product state changed');
        }
      }

      const transactionUpdate = await tx.transaction.updateMany({
        where: {
          id: transaction.id,
          status: { in: [...CANCELLABLE_STATUSES] },
        },
        data: { status: TxStatus.CANCELLED },
      });

      if (transactionUpdate.count !== 1) {
        throw new ConflictException('Transaction state changed');
      }

      return this.findTransactionResponseOrThrow(tx, transaction.id);
    });
  }

  async completeTransaction(
    transactionId: string,
    sellerId: string,
  ): Promise<TransactionResponse> {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
        select: TRANSACTION_STATE_SELECT,
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      this.assertSeller(transaction, sellerId);

      if (!this.isCompletableStatus(transaction.status)) {
        throw new BadRequestException('Transaction cannot be completed');
      }

      const productUpdate = await tx.product.updateMany({
        where: {
          id: transaction.productId,
          isHidden: false,
          status: ProductStatus.RESERVED,
        },
        data: { status: ProductStatus.SOLD },
      });

      if (productUpdate.count !== 1) {
        throw new ConflictException('Product state changed');
      }

      const transactionUpdate = await tx.transaction.updateMany({
        where: {
          id: transaction.id,
          status: { in: [...COMPLETABLE_STATUSES] },
        },
        data: { status: TxStatus.COMPLETED },
      });

      if (transactionUpdate.count !== 1) {
        throw new ConflictException('Transaction state changed');
      }

      await Promise.all([
        tx.user.updateMany({
          where: { id: transaction.buyerId },
          data: {
            completedTx: { increment: 1 },
            trustScore: { increment: 1 },
          },
        }),
        tx.user.updateMany({
          where: { id: transaction.sellerId },
          data: {
            completedTx: { increment: 1 },
            trustScore: { increment: 1 },
          },
        }),
      ]);

      return this.findTransactionResponseOrThrow(tx, transaction.id);
    });
  }

  async listTransactions(
    userId: string,
    query: ListTransactionsDto,
  ): Promise<PaginatedTransactionsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildListWhere(userId, query);

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: TRANSACTION_RESPONSE_SELECT,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toTransactionResponse(item)),
      page,
      limit,
      total,
    };
  }

  async getTransactionForParticipant(
    transactionId: string,
    userId: string,
  ): Promise<TransactionResponse> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: TRANSACTION_RESPONSE_SELECT,
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.buyer.id !== userId && transaction.seller.id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.toTransactionResponse(transaction);
  }

  async createReview(
    transactionId: string,
    authorId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewResponse> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: TRANSACTION_STATE_SELECT,
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    this.assertParticipant(transaction, authorId);

    if (transaction.status !== TxStatus.COMPLETED) {
      throw new BadRequestException('Reviews require completed transactions');
    }

    const existingReview = await this.prisma.review.findFirst({
      where: { transactionId, authorId },
      select: { id: true },
    });

    if (existingReview) {
      throw new ConflictException('Review already exists');
    }

    try {
      const review = await this.prisma.review.create({
        data: {
          transactionId,
          authorId,
          targetId: this.getCounterpartId(transaction, authorId),
          rating: dto.rating,
          comment: dto.comment,
        },
        select: REVIEW_RESPONSE_SELECT,
      });

      return this.toReviewResponse(review);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Review already exists');
      }

      throw error;
    }
  }

  private async findTransactionResponseOrThrow(
    tx: Prisma.TransactionClient,
    transactionId: string,
  ): Promise<TransactionResponse> {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
      select: TRANSACTION_RESPONSE_SELECT,
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return this.toTransactionResponse(transaction);
  }

  private assertProductRequestable(
    product: ProductForTransaction | null,
    buyerId: string,
  ): asserts product is ProductForTransaction {
    if (!product || product.status === ProductStatus.HIDDEN) {
      throw new NotFoundException('Product not found');
    }

    if (product.sellerId === buyerId) {
      throw new BadRequestException('Cannot request your own product');
    }

    if (product.status !== ProductStatus.ON_SALE) {
      throw new BadRequestException('Product is not available');
    }
  }

  private assertSeller(transaction: TransactionState, userId: string): void {
    if (transaction.sellerId !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }

  private assertParticipant(transaction: TransactionState, userId: string): void {
    if (transaction.buyerId !== userId && transaction.sellerId !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }

  private getCounterpartId(
    transaction: TransactionState,
    authorId: string,
  ): string {
    return transaction.buyerId === authorId
      ? transaction.sellerId
      : transaction.buyerId;
  }

  private isCancellableStatus(status: TxStatus): boolean {
    return CANCELLABLE_STATUSES.includes(
      status as (typeof CANCELLABLE_STATUSES)[number],
    );
  }

  private isCompletableStatus(status: TxStatus): boolean {
    return COMPLETABLE_STATUSES.includes(
      status as (typeof COMPLETABLE_STATUSES)[number],
    );
  }

  private shouldRestoreProductOnCancel(status: TxStatus): boolean {
    return status === TxStatus.RESERVED || status === TxStatus.PAYMENT_PENDING;
  }

  private buildListWhere(
    userId: string,
    query: ListTransactionsDto,
  ): Prisma.TransactionWhereInput {
    const statusFilter =
      query.status !== undefined ? { status: query.status } : {};

    if (query.role === 'buyer') {
      return { buyerId: userId, ...statusFilter };
    }

    if (query.role === 'seller') {
      return { sellerId: userId, ...statusFilter };
    }

    return {
      OR: [{ buyerId: userId }, { sellerId: userId }],
      ...statusFilter,
    };
  }

  private toTransactionResponse(
    transaction: TransactionRecord,
  ): TransactionResponse {
    return {
      id: transaction.id,
      status: transaction.status,
      amount: transaction.amount,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      product: {
        id: transaction.product.id,
        title: transaction.product.title,
        price: transaction.product.price,
        status: transaction.product.status,
        thumbnailUrl: transaction.product.images[0]?.url ?? null,
      },
      buyer: transaction.buyer,
      seller: transaction.seller,
    };
  }

  private toReviewResponse(review: ReviewRecord): ReviewResponse {
    return {
      id: review.id,
      transactionId: review.transactionId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      author: review.author,
      target: review.target,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
