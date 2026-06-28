import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CreateChatDto } from './create-chat.dto';
import { ListChatMessagesDto } from './list-chat-messages.dto';
import { ListChatsDto } from './list-chats.dto';
import { SendMessageDto } from './send-message.dto';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function validateDto<T extends object>(
  metatype: new () => T,
  value: Record<string, unknown>,
  type: 'body' | 'query' = 'body',
): Promise<T> {
  return validationPipe.transform(value, {
    type,
    metatype,
  }) as Promise<T>;
}

describe('Chat DTO validation', () => {
  it('accepts a valid chat creation payload', async () => {
    await expect(
      validateDto(CreateChatDto, {
        productId: '11111111-1111-4111-8111-111111111111',
      }),
    ).resolves.toBeInstanceOf(CreateChatDto);
  });

  it('rejects buyerId, sellerId, and userId injection on chat creation', async () => {
    await expect(
      validateDto(CreateChatDto, {
        productId: '11111111-1111-4111-8111-111111111111',
        buyerId: '22222222-2222-4222-8222-222222222222',
        sellerId: '33333333-3333-4333-8333-333333333333',
        userId: '44444444-4444-4444-8444-444444444444',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a valid message payload', async () => {
    await expect(
      validateDto(SendMessageDto, {
        content: '안녕하세요',
        imageUrl: 'chats/example.png',
      }),
    ).resolves.toBeInstanceOf(SendMessageDto);
  });

  it('rejects senderId, chatId, and isRead injection on message send', async () => {
    await expect(
      validateDto(SendMessageDto, {
        content: '권한 필드 주입',
        senderId: '22222222-2222-4222-8222-222222222222',
        chatId: '33333333-3333-4333-8333-333333333333',
        isRead: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects empty and over-limit message content', async () => {
    await expect(
      validateDto(SendMessageDto, { content: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      validateDto(SendMessageDto, { content: 'a'.repeat(2001) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('treats XSS payloads as valid plain string message content', async () => {
    const dto = await validateDto(SendMessageDto, {
      content: '<script>alert(1)</script>',
    });

    expect(dto.content).toBe('<script>alert(1)</script>');
  });

  it('transforms chat list pagination query values', async () => {
    const dto = await validateDto(
      ListChatsDto,
      {
        page: '2',
        limit: '10',
      },
      'query',
    );

    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(10);
  });

  it('transforms message list pagination query values', async () => {
    const dto = await validateDto(
      ListChatMessagesDto,
      {
        page: '3',
        limit: '5',
      },
      'query',
    );

    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(5);
  });
});
