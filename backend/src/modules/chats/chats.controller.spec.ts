import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ChatsController } from './chats.controller';

function getMethodGuards(methodName: keyof ChatsController): unknown[] {
  return (
    (Reflect.getMetadata(
      GUARDS_METADATA,
      ChatsController.prototype[methodName],
    ) as unknown[] | undefined) ?? []
  );
}

describe('ChatsController guards', () => {
  it('requires JWT auth for chat creation', () => {
    expect(getMethodGuards('createChat')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for chat list', () => {
    expect(getMethodGuards('listChats')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for chat detail', () => {
    expect(getMethodGuards('getChat')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for message list', () => {
    expect(getMethodGuards('listMessages')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for message send', () => {
    expect(getMethodGuards('sendMessage')).toContain(JwtAuthGuard);
  });

  it('requires JWT auth for read marking', () => {
    expect(getMethodGuards('markRead')).toContain(JwtAuthGuard);
  });
});
