export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface ConfirmPaymentInput {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export interface CancelPaymentInput {
  paymentKey: string;
  cancelReason: string;
  amount: number;
}

export interface ProviderPaymentResult {
  paymentKey: string;
  orderId: string;
  status: string;
  amount: number;
  receiptUrl: string | null;
}

export interface PaymentProvider {
  confirmPayment(input: ConfirmPaymentInput): Promise<ProviderPaymentResult>;
  cancelPayment(input: CancelPaymentInput): Promise<ProviderPaymentResult>;
  getPayment(paymentKey: string): Promise<ProviderPaymentResult>;
}
