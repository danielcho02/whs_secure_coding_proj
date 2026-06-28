import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PaymentStatus, Prisma, ProductStatus, TxStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ApprovePaymentDto } from './dto/approve-payment.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import {
  PaymentReceiptResponse,
  PaymentResponse,
  PaymentWebhookResult,
} from './dto/payment-response.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PAYMENTS_CONFIG, PaymentsConfig } from './payments.config';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
  ProviderPaymentResult,
} from './providers/payment-provider.interface';
import {
  TossWebhookSignatureHeaders,
  TossWebhookVerifier,
} from './toss-webhook-verifier';
import { PrismaService } from '../prisma/prisma.service';

const PUBLIC_USER_SELECT = {
  id: true,
  nickname: true,
  avatarUrl: true,
  trustScore: true,
  completedTx: true,
} satisfies Prisma.UserSelect;

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

const PAYMENT_CORE_SELECT = {
  id: true,
  transactionId: true,
  amount: true,
  status: true,
  idempotencyKey: true,
  escrowReleased: true,
  pgTxId: true,
  orderId: true,
  orderName: true,
  receiptUrl: true,
  paidAt: true,
  refundedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaymentSelect;

const TRANSACTION_FOR_PAYMENT_SELECT = {
  id: true,
  productId: true,
  buyerId: true,
  sellerId: true,
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
  payment: {
    select: PAYMENT_CORE_SELECT,
  },
} satisfies Prisma.TransactionSelect;

const PAYMENT_RESPONSE_SELECT = {
  ...PAYMENT_CORE_SELECT,
  transaction: {
    select: {
      id: true,
      productId: true,
      buyerId: true,
      sellerId: true,
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
    },
  },
} satisfies Prisma.PaymentSelect;

const PAYMENT_CREATABLE_STATUSES = [
  TxStatus.RESERVED,
  TxStatus.PAYMENT_PENDING,
] as const;

const PAYMENT_APPROVABLE_STATUSES = [
  TxStatus.RESERVED,
  TxStatus.PAYMENT_PENDING,
] as const;

const PURCHASE_CONFIRMABLE_STATUSES = [TxStatus.PAID, TxStatus.SHIPPING] as const;

type PaymentCoreRecord = Prisma.PaymentGetPayload<{
  select: typeof PAYMENT_CORE_SELECT;
}>;

type TransactionForPaymentRecord = Prisma.TransactionGetPayload<{
  select: typeof TRANSACTION_FOR_PAYMENT_SELECT;
}>;

type PaymentRecord = Prisma.PaymentGetPayload<{
  select: typeof PAYMENT_RESPONSE_SELECT;
}>;

type PaymentRecordLike = PaymentCoreRecord & {
  transaction: Omit<TransactionForPaymentRecord, 'payment'>;
};

type PaymentsCheckoutConfig = Pick<
  PaymentsConfig,
  'tossClientKey' | 'successUrl' | 'failUrl' | 'cancelUrl'
>;

interface WebhookPaymentPayload {
  orderId: string | null;
  paymentKey: string | null;
  status: string | null;
  amount: number | null;
  eventId: string | null;
}

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: PaymentProvider,
    @Inject(TossWebhookVerifier)
    private readonly webhookVerifier: TossWebhookVerifier,
    @Inject(PAYMENTS_CONFIG)
    private readonly paymentsConfig: PaymentsCheckoutConfig,
  ) {}

  async createPayment(
    userId: string,
    dto: CreatePaymentDto,
  ): Promise<PaymentResponse> {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: dto.transactionId },
        select: TRANSACTION_FOR_PAYMENT_SELECT,
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      this.assertBuyer(transaction, userId);
      this.assertServerAmountConsistent(transaction);

      if (transaction.payment) {
        if (transaction.payment.idempotencyKey === dto.idempotencyKey) {
          return this.toPaymentResponse(
            this.attachTransaction(transaction.payment, transaction),
          );
        }

        throw new ConflictException('Payment already exists for transaction');
      }

      if (!this.isPaymentCreatableStatus(transaction.status)) {
        throw new BadRequestException('Transaction cannot be paid');
      }

      const orderName = this.buildOrderName(transaction.product.title);
      const payment = await tx.payment.create({
        data: {
          transactionId: transaction.id,
          amount: transaction.amount,
          status: PaymentStatus.PENDING,
          idempotencyKey: dto.idempotencyKey,
          orderId: this.buildOrderId(),
          orderName,
        },
        select: PAYMENT_CORE_SELECT,
      });

      const transactionUpdate = await tx.transaction.updateMany({
        where: {
          id: transaction.id,
          status: { in: [...PAYMENT_CREATABLE_STATUSES] },
        },
        data: { status: TxStatus.PAYMENT_PENDING },
      });

      if (transactionUpdate.count !== 1) {
        throw new ConflictException('Transaction state changed');
      }

      await this.writeAuditLog(tx, userId, 'PAYMENT_CREATED', {
        paymentId: payment.id,
        transactionId: transaction.id,
        amount: payment.amount,
      });

      return this.toPaymentResponse(
        this.attachTransaction(payment, {
          ...transaction,
          status: TxStatus.PAYMENT_PENDING,
        }),
      );
    });
  }

  async approvePayment(
    userId: string,
    paymentId: string,
    dto: ApprovePaymentDto,
  ): Promise<PaymentResponse> {
    const payment = await this.findPaymentOrThrow(paymentId);

    this.assertBuyer(payment.transaction, userId);
    this.assertApprovalRequestMatches(payment, dto);

    if (payment.status === PaymentStatus.PAID) {
      this.assertAlreadyPaidRequestMatches(payment, dto);
      return this.toPaymentResponse(payment);
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment cannot be approved');
    }

    const providerResult = await this.paymentProvider.confirmPayment({
      paymentKey: dto.paymentKey,
      orderId: dto.orderId,
      amount: dto.amount,
    });

    this.assertProviderApprovalMatches(payment, providerResult);

    return this.markPaymentPaid(payment, providerResult, userId);
  }

  async handleWebhook(
    rawBody: Buffer,
    headers: TossWebhookSignatureHeaders,
    payload: unknown,
  ): Promise<PaymentWebhookResult> {
    if (!this.webhookVerifier.verify(rawBody, headers)) {
      throw new UnauthorizedException('Invalid payment webhook signature');
    }

    const webhookPayload = this.extractWebhookPayload(payload);

    if (!webhookPayload.orderId && !webhookPayload.paymentKey) {
      return { status: 'ignored' };
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          ...(webhookPayload.orderId
            ? [{ orderId: webhookPayload.orderId }]
            : []),
          ...(webhookPayload.paymentKey
            ? [{ pgTxId: webhookPayload.paymentKey }]
            : []),
        ],
      },
      select: PAYMENT_RESPONSE_SELECT,
    });

    if (!payment) {
      return { status: 'ignored' };
    }

    if (
      typeof webhookPayload.amount === 'number' &&
      webhookPayload.amount !== payment.amount
    ) {
      throw new BadRequestException('Webhook amount mismatch');
    }

    const targetStatus = this.mapProviderStatus(webhookPayload.status);

    if (!targetStatus || payment.status === targetStatus) {
      return { status: 'ignored' };
    }

    if (targetStatus === PaymentStatus.PAID) {
      await this.markPaymentPaid(
        payment,
        {
          paymentKey: webhookPayload.paymentKey ?? payment.pgTxId ?? '',
          orderId: payment.orderId,
          status: 'DONE',
          amount: payment.amount,
          receiptUrl: payment.receiptUrl,
        },
        null,
      );
      return { status: 'processed' };
    }

    if (targetStatus === PaymentStatus.CANCELED) {
      await this.markPaymentCancelled(payment, null);
      return { status: 'processed' };
    }

    if (targetStatus === PaymentStatus.REFUNDED) {
      await this.markPaymentRefunded(payment, null, payment.receiptUrl);
      return { status: 'processed' };
    }

    return { status: 'ignored' };
  }

  async confirmPurchase(
    userId: string,
    paymentId: string,
  ): Promise<PaymentResponse> {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        select: PAYMENT_RESPONSE_SELECT,
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      this.assertBuyer(payment.transaction, userId);

      if (payment.status !== PaymentStatus.PAID) {
        throw new BadRequestException('Only paid payments can be confirmed');
      }

      if (payment.escrowReleased) {
        throw new BadRequestException('Escrow already released');
      }

      if (!this.isPurchaseConfirmableStatus(payment.transaction.status)) {
        throw new BadRequestException('Transaction cannot be completed');
      }

      const transactionUpdate = await tx.transaction.updateMany({
        where: {
          id: payment.transactionId,
          status: { in: [...PURCHASE_CONFIRMABLE_STATUSES] },
        },
        data: { status: TxStatus.COMPLETED },
      });

      if (transactionUpdate.count !== 1) {
        throw new ConflictException('Transaction state changed');
      }

      const productUpdate = await tx.product.updateMany({
        where: {
          id: payment.transaction.product.id,
          status: ProductStatus.RESERVED,
        },
        data: { status: ProductStatus.SOLD },
      });

      if (productUpdate.count !== 1) {
        throw new ConflictException('Product state changed');
      }

      await Promise.all([
        tx.user.updateMany({
          where: { id: payment.transaction.buyerId },
          data: {
            completedTx: { increment: 1 },
            trustScore: { increment: 1 },
          },
        }),
        tx.user.updateMany({
          where: { id: payment.transaction.sellerId },
          data: {
            completedTx: { increment: 1 },
            trustScore: { increment: 1 },
          },
        }),
      ]);

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: { escrowReleased: true },
        select: PAYMENT_RESPONSE_SELECT,
      });

      await this.writeAuditLog(tx, userId, 'ESCROW_RELEASED', {
        paymentId: payment.id,
        transactionId: payment.transactionId,
      });

      return this.toPaymentResponse(updatedPayment);
    });
  }

  async refundPayment(
    userId: string,
    paymentId: string,
    dto: RefundPaymentDto,
  ): Promise<PaymentResponse> {
    const payment = await this.findPaymentOrThrow(paymentId);

    this.assertParticipant(payment.transaction, userId);

    if (payment.escrowReleased) {
      throw new BadRequestException('Released escrow cannot be normally refunded');
    }

    if (
      payment.status === PaymentStatus.REFUNDED ||
      payment.status === PaymentStatus.CANCELED
    ) {
      return this.toPaymentResponse(payment);
    }

    if (payment.status === PaymentStatus.PENDING) {
      return this.markPaymentCancelled(payment, userId);
    }

    if (payment.status !== PaymentStatus.PAID) {
      throw new BadRequestException('Payment cannot be refunded');
    }

    if (!payment.pgTxId) {
      throw new ConflictException('Payment provider transaction is missing');
    }

    const providerResult = await this.paymentProvider.cancelPayment({
      paymentKey: payment.pgTxId,
      cancelReason: dto.reason ?? '중고거래 안전결제 환불',
    });

    if (providerResult.amount !== payment.amount) {
      throw new BadRequestException('Refund amount mismatch');
    }

    return this.markPaymentRefunded(payment, userId, providerResult.receiptUrl);
  }

  async getReceipt(
    userId: string,
    paymentId: string,
  ): Promise<PaymentReceiptResponse> {
    const payment = await this.findPaymentOrThrow(paymentId);

    this.assertParticipant(payment.transaction, userId);

    return this.toReceiptResponse(payment);
  }

  private async findPaymentOrThrow(paymentId: string): Promise<PaymentRecord> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: PAYMENT_RESPONSE_SELECT,
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  private async markPaymentPaid(
    payment: PaymentRecordLike,
    providerResult: ProviderPaymentResult,
    userId: string | null,
  ): Promise<PaymentResponse> {
    return this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          pgTxId: providerResult.paymentKey || payment.pgTxId,
          receiptUrl: providerResult.receiptUrl,
          paidAt: new Date(),
        },
        select: PAYMENT_RESPONSE_SELECT,
      });

      const transactionUpdate = await tx.transaction.updateMany({
        where: {
          id: payment.transactionId,
          status: { in: [...PAYMENT_APPROVABLE_STATUSES] },
        },
        data: { status: TxStatus.PAID },
      });

      if (
        transactionUpdate.count !== 1 &&
        payment.transaction.status !== TxStatus.PAID
      ) {
        throw new ConflictException('Transaction state changed');
      }

      await this.writeAuditLog(tx, userId, 'PAYMENT_PAID', {
        paymentId: payment.id,
        transactionId: payment.transactionId,
        amount: payment.amount,
      });

      return this.toPaymentResponse(updatedPayment);
    });
  }

  private async markPaymentCancelled(
    payment: PaymentRecordLike,
    userId: string | null,
  ): Promise<PaymentResponse> {
    return this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.CANCELED },
        select: PAYMENT_RESPONSE_SELECT,
      });

      await tx.transaction.updateMany({
        where: {
          id: payment.transactionId,
          status: { in: [TxStatus.PAYMENT_PENDING, TxStatus.RESERVED] },
        },
        data: { status: TxStatus.CANCELLED },
      });

      await this.restoreProductIfNotReleased(tx, payment);

      await this.writeAuditLog(tx, userId, 'PAYMENT_CANCELED', {
        paymentId: payment.id,
        transactionId: payment.transactionId,
      });

      return this.toPaymentResponse(updatedPayment);
    });
  }

  private async markPaymentRefunded(
    payment: PaymentRecordLike,
    userId: string | null,
    receiptUrl: string | null,
  ): Promise<PaymentResponse> {
    return this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          receiptUrl: receiptUrl ?? payment.receiptUrl,
          refundedAt: new Date(),
        },
        select: PAYMENT_RESPONSE_SELECT,
      });

      await tx.transaction.updateMany({
        where: { id: payment.transactionId, status: TxStatus.PAID },
        data: { status: TxStatus.REFUNDED },
      });

      await this.restoreProductIfNotReleased(tx, payment);

      await this.writeAuditLog(tx, userId, 'PAYMENT_REFUNDED', {
        paymentId: payment.id,
        transactionId: payment.transactionId,
        amount: payment.amount,
      });

      return this.toPaymentResponse(updatedPayment);
    });
  }

  private async restoreProductIfNotReleased(
    tx: Prisma.TransactionClient,
    payment: PaymentRecordLike,
  ): Promise<void> {
    if (payment.escrowReleased) {
      return;
    }

    await tx.product.updateMany({
      where: {
        id: payment.transaction.product.id,
        status: ProductStatus.RESERVED,
      },
      data: { status: ProductStatus.ON_SALE },
    });
  }

  private attachTransaction(
    payment: PaymentCoreRecord,
    transaction: TransactionForPaymentRecord,
  ): PaymentRecordLike {
    const { payment: _payment, ...transactionWithoutPayment } = transaction;
    void _payment;

    return {
      ...payment,
      transaction: transactionWithoutPayment,
    };
  }

  private assertBuyer(
    transaction: Pick<TransactionForPaymentRecord, 'buyerId'>,
    userId: string,
  ): void {
    if (transaction.buyerId !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }

  private assertParticipant(
    transaction: Pick<TransactionForPaymentRecord, 'buyerId' | 'sellerId'>,
    userId: string,
  ): void {
    if (transaction.buyerId !== userId && transaction.sellerId !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }

  private assertServerAmountConsistent(
    transaction: TransactionForPaymentRecord,
  ): void {
    if (transaction.amount !== transaction.product.price) {
      throw new ConflictException('Transaction amount is inconsistent');
    }
  }

  private assertApprovalRequestMatches(
    payment: PaymentRecordLike,
    dto: ApprovePaymentDto,
  ): void {
    if (payment.orderId !== dto.orderId) {
      throw new BadRequestException('Order id mismatch');
    }

    if (payment.amount !== dto.amount) {
      throw new BadRequestException('Payment amount mismatch');
    }
  }

  private assertAlreadyPaidRequestMatches(
    payment: PaymentRecordLike,
    dto: ApprovePaymentDto,
  ): void {
    if (payment.pgTxId && payment.pgTxId !== dto.paymentKey) {
      throw new ConflictException('Payment key mismatch');
    }
  }

  private assertProviderApprovalMatches(
    payment: PaymentRecordLike,
    providerResult: ProviderPaymentResult,
  ): void {
    if (providerResult.orderId !== payment.orderId) {
      throw new BadRequestException('Provider order id mismatch');
    }

    if (providerResult.amount !== payment.amount) {
      throw new BadRequestException('Provider amount mismatch');
    }

    if (providerResult.status !== 'DONE') {
      throw new BadRequestException('Provider payment is not approved');
    }
  }

  private isPaymentCreatableStatus(status: TxStatus): boolean {
    return PAYMENT_CREATABLE_STATUSES.includes(
      status as (typeof PAYMENT_CREATABLE_STATUSES)[number],
    );
  }

  private isPurchaseConfirmableStatus(status: TxStatus): boolean {
    return PURCHASE_CONFIRMABLE_STATUSES.includes(
      status as (typeof PURCHASE_CONFIRMABLE_STATUSES)[number],
    );
  }

  private mapProviderStatus(status: string | null): PaymentStatus | null {
    if (!status) {
      return null;
    }

    switch (status) {
      case 'DONE':
      case 'PAID':
        return PaymentStatus.PAID;
      case 'CANCELED':
      case 'CANCELLED':
      case 'ABORTED':
      case 'EXPIRED':
        return PaymentStatus.CANCELED;
      case 'REFUNDED':
      case 'PARTIAL_CANCELED':
        return PaymentStatus.REFUNDED;
      default:
        return null;
    }
  }

  private extractWebhookPayload(payload: unknown): WebhookPaymentPayload {
    const eventObject = this.asRecord(payload);
    const dataObject = this.asRecord(eventObject.data) ?? eventObject;

    return {
      orderId: this.readOptionalString(dataObject.orderId),
      paymentKey: this.readOptionalString(dataObject.paymentKey),
      status:
        this.readOptionalString(dataObject.status) ??
        this.readOptionalString(dataObject.paymentStatus),
      amount:
        this.readOptionalNumber(dataObject.totalAmount) ??
        this.readOptionalNumber(dataObject.amount),
      eventId:
        this.readOptionalString(eventObject.eventId) ??
        this.readOptionalString(eventObject.id),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  private readOptionalString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private readOptionalNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isSafeInteger(value)
      ? value
      : null;
  }

  private buildOrderId(): string {
    return `order_${randomUUID()}`;
  }

  private buildOrderName(productTitle: string): string {
    return productTitle.slice(0, 100);
  }

  private toPaymentResponse(payment: PaymentRecordLike): PaymentResponse {
    const transactionSummary = this.buildTransactionSummary(payment);

    return {
      id: payment.id,
      transactionId: payment.transactionId,
      amount: payment.amount,
      status: payment.status,
      idempotencyKey: payment.idempotencyKey,
      escrowReleased: payment.escrowReleased,
      pgTxId: payment.pgTxId,
      orderId: payment.orderId,
      orderName: payment.orderName,
      receiptUrl: payment.receiptUrl,
      paidAt: payment.paidAt,
      refundedAt: payment.refundedAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      transaction: transactionSummary,
      buyer: payment.transaction.buyer,
      seller: payment.transaction.seller,
      checkout: {
        clientKey: this.paymentsConfig.tossClientKey,
        customerKey: payment.transaction.buyerId,
        orderId: payment.orderId,
        orderName: payment.orderName,
        amount: payment.amount,
        successUrl: this.paymentsConfig.successUrl,
        failUrl: this.paymentsConfig.failUrl,
        cancelUrl: this.paymentsConfig.cancelUrl,
      },
    };
  }

  private toReceiptResponse(payment: PaymentRecordLike): PaymentReceiptResponse {
    return {
      id: payment.id,
      transactionId: payment.transactionId,
      amount: payment.amount,
      status: payment.status,
      escrowReleased: payment.escrowReleased,
      pgTxId: payment.pgTxId,
      orderId: payment.orderId,
      orderName: payment.orderName,
      receiptUrl: payment.receiptUrl,
      paidAt: payment.paidAt,
      refundedAt: payment.refundedAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      transaction: this.buildTransactionSummary(payment),
      buyer: payment.transaction.buyer,
      seller: payment.transaction.seller,
    };
  }

  private buildTransactionSummary(
    payment: PaymentRecordLike,
  ): PaymentResponse['transaction'] {
    return {
      id: payment.transaction.id,
      status: payment.transaction.status,
      amount: payment.transaction.amount,
      product: {
        id: payment.transaction.product.id,
        title: payment.transaction.product.title,
        price: payment.transaction.product.price,
        status: payment.transaction.product.status,
        thumbnailUrl: payment.transaction.product.images[0]?.url ?? null,
      },
    };
  }

  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    userId: string | null,
    event: string,
    detail: Record<string, string | number>,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        userId,
        event,
        detail: JSON.stringify(detail),
      },
    });
  }
}
