import { createHmac, timingSafeEqual } from 'crypto';

export interface TossWebhookSignatureHeaders {
  signature: string | null;
  timestamp: string | null;
}

export class TossWebhookVerifier {
  constructor(private readonly webhookSecret: string) {}

  verify(rawBody: Buffer, headers: TossWebhookSignatureHeaders): boolean {
    if (!this.webhookSecret || !headers.signature || !headers.timestamp) {
      return false;
    }

    const expectedSignature = this.sign(rawBody, headers.timestamp);
    const candidates = this.parseSignatureCandidates(headers.signature);

    return candidates.some((candidate) =>
      this.safeCompare(candidate, expectedSignature),
    );
  }

  createSignedHeadersForTest(
    rawBody: Buffer,
    timestamp = '2026-01-01T00:00:00.000Z',
  ): TossWebhookSignatureHeaders {
    return {
      signature: `v1=${this.sign(rawBody, timestamp)}`,
      timestamp,
    };
  }

  private sign(rawBody: Buffer, timestamp: string): string {
    return createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${rawBody.toString('utf8')}`)
      .digest('base64');
  }

  private parseSignatureCandidates(signatureHeader: string): string[] {
    return signatureHeader
      .split(',')
      .map((part) => part.trim())
      .map((part) => (part.startsWith('v1=') ? part.slice(3) : part))
      .filter((part) => part.length > 0);
  }

  private safeCompare(actual: string, expected: string): boolean {
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);

    if (actualBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(actualBuffer, expectedBuffer);
  }
}
