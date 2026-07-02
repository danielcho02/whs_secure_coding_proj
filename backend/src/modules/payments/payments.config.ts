export const PAYMENTS_CONFIG = Symbol('PAYMENTS_CONFIG');

export interface PaymentsConfig {
  providerMode: 'mock' | 'toss';
  tossClientKey: string;
  tossSecretKey: string;
  webhookSecret: string;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
}
