import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const seedSource = readFileSync(join(__dirname, 'seed.ts'), 'utf8');

const forbiddenUserFacingSeedSnippets = [
  'Dev ON_SALE',
  'Dev RESERVED',
  'Dev SOLD',
  'Dev HIDDEN',
  'Dev 신고',
  'Dev 이미지',
  'Dev 검색',
  'Dev PAYMENT_PENDING',
  'Dev PAID',
  'Dev CANCELLED',
  'Dev REFUNDED',
  'dev-seller',
  'dev-buyer',
  'dev-admin',
  'dev-blocked',
  'dev-suspended',
  'dev-banned',
  'dev-second',
  '정상 기능 확인용',
  '확인용 seed',
  '시연용',
  'seed 숨김',
  'seed 복구',
  'seed 정지',
  'seed 사용자',
  'seed 신고',
  'seed 확인용',
  'secure-keyword-alpha',
  'Ctrl+Enter',
  '테스트 상품입니다',
  '테스트 메시지',
  '환불 처리된 이력',
  '위험 표현은 확인되지 않아 안내 메시지를 발송하고 종결했습니다.',
  'SEED_ADMIN_LOG',
  '[DEV]',
  'dev_seed',
];

describe('seed content', () => {
  it('does not expose development or QA copy in seeded user-facing data', () => {
    expect(
      forbiddenUserFacingSeedSnippets.filter((snippet) =>
        seedSource.includes(snippet),
      ),
    ).toEqual([]);
  });

  it('resets seeded account login lock state so demo credentials remain usable', () => {
    expect(seedSource).toContain('loginFails: 0');
    expect(seedSource).toContain('lockedUntil: null');
  });

  it('blocks seed execution in production', () => {
    expect(seedSource).toContain('assertSeedEnvironment');
    expect(seedSource).toContain("process.env.NODE_ENV === 'production'");
  });
});
