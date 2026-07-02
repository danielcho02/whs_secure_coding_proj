import { Injectable } from '@nestjs/common';
import {
  CancelPaymentInput,
  ConfirmPaymentInput,
  PaymentProvider,
  ProviderPaymentResult,
} from './payment-provider.interface';

@Injectable()
export class MockPaymentsProvider implements PaymentProvider {
  confirmPayment(
    input: ConfirmPaymentInput,
  ): Promise<ProviderPaymentResult> {
    return Promise.resolve({
      paymentKey: input.paymentKey,
      orderId: input.orderId,
      status: 'DONE',
      amount: input.amount,
      receiptUrl: `http://localhost/mock-receipts/${encodeURIComponent(input.orderId)}`,
    });
  }

  cancelPayment(
    input: CancelPaymentInput,
  ): Promise<ProviderPaymentResult> {
    return Promise.resolve({
      paymentKey: input.paymentKey,
      orderId: '',
      status: 'CANCELED',
      amount: input.amount,
      receiptUrl: null,
    });
  }

  getPayment(paymentKey: string): Promise<ProviderPaymentResult> {
    return Promise.resolve({
      paymentKey,
      orderId: '',
      status: 'DONE',
      amount: 0,
      receiptUrl: null,
    });
  }
}
