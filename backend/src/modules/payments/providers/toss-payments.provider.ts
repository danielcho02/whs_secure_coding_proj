import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PAYMENTS_CONFIG, PaymentsConfig } from '../payments.config';
import {
  CancelPaymentInput,
  ConfirmPaymentInput,
  PaymentProvider,
  ProviderPaymentResult,
} from './payment-provider.interface';

const TOSS_API_BASE_URL = 'https://api.tosspayments.com';

interface TossReceipt {
  url?: unknown;
}

interface TossPaymentResponse {
  paymentKey?: unknown;
  orderId?: unknown;
  status?: unknown;
  totalAmount?: unknown;
  receipt?: unknown;
}

@Injectable()
export class TossPaymentsProvider implements PaymentProvider {
  constructor(
    @Inject(PAYMENTS_CONFIG)
    private readonly paymentsConfig: PaymentsConfig,
  ) {}

  async confirmPayment(
    input: ConfirmPaymentInput,
  ): Promise<ProviderPaymentResult> {
    return this.requestPayment('/v1/payments/confirm', {
      paymentKey: input.paymentKey,
      orderId: input.orderId,
      amount: input.amount,
    });
  }

  async cancelPayment(
    input: CancelPaymentInput,
  ): Promise<ProviderPaymentResult> {
    return this.requestPayment(
      `/v1/payments/${encodeURIComponent(input.paymentKey)}/cancel`,
      { cancelReason: input.cancelReason },
    );
  }

  async getPayment(paymentKey: string): Promise<ProviderPaymentResult> {
    const response = await fetch(
      `${TOSS_API_BASE_URL}/v1/payments/${encodeURIComponent(paymentKey)}`,
      {
        method: 'GET',
        headers: {
          Authorization: this.buildAuthorizationHeader(),
        },
      },
    );

    return this.parseResponse(response);
  }

  private async requestPayment(
    path: string,
    body: Record<string, string | number>,
  ): Promise<ProviderPaymentResult> {
    const response = await fetch(`${TOSS_API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: this.buildAuthorizationHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return this.parseResponse(response);
  }

  private async parseResponse(
    response: Response,
  ): Promise<ProviderPaymentResult> {
    const payload = (await response.json()) as TossPaymentResponse;

    if (!response.ok) {
      throw new BadRequestException('Payment provider request failed');
    }

    return {
      paymentKey: this.readRequiredString(payload.paymentKey, 'paymentKey'),
      orderId: this.readRequiredString(payload.orderId, 'orderId'),
      status: this.readRequiredString(payload.status, 'status'),
      amount: this.readRequiredNumber(payload.totalAmount, 'totalAmount'),
      receiptUrl: this.readReceiptUrl(payload.receipt),
    };
  }

  private buildAuthorizationHeader(): string {
    const token = Buffer.from(`${this.paymentsConfig.tossSecretKey}:`).toString(
      'base64',
    );
    return `Basic ${token}`;
  }

  private readRequiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.length === 0) {
      throw new BadRequestException(`Invalid provider response: ${field}`);
    }

    return value;
  }

  private readRequiredNumber(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
      throw new BadRequestException(`Invalid provider response: ${field}`);
    }

    return value;
  }

  private readReceiptUrl(receipt: unknown): string | null {
    if (!receipt || typeof receipt !== 'object') {
      return null;
    }

    const tossReceipt = receipt as TossReceipt;
    return typeof tossReceipt.url === 'string' ? tossReceipt.url : null;
  }
}
