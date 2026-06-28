import { describe, expect, it } from 'vitest';
import { TossWebhookVerifier } from './toss-webhook-verifier';

describe('TossWebhookVerifier', () => {
  it('accepts a valid HMAC signature for the raw webhook body', () => {
    const verifier = new TossWebhookVerifier('webhook-secret');
    const rawBody = Buffer.from('{"orderId":"order_1","status":"DONE"}');
    const headers = verifier.createSignedHeadersForTest(rawBody);

    expect(verifier.verify(rawBody, headers)).toBe(true);
  });

  it('rejects a mismatched signature', () => {
    const verifier = new TossWebhookVerifier('webhook-secret');
    const rawBody = Buffer.from('{"orderId":"order_1","status":"DONE"}');

    expect(
      verifier.verify(rawBody, {
        signature: 'v1=invalid',
        timestamp: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe(false);
  });
});
