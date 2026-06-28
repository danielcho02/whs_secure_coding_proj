import { IsUUID } from 'class-validator';
import { SendMessageDto } from './send-message.dto';

export class JoinChatEventDto {
  @IsUUID('4')
  chatId!: string;
}

export class ReadChatEventDto {
  @IsUUID('4')
  chatId!: string;
}

export class SendChatEventDto extends SendMessageDto {
  @IsUUID('4')
  chatId!: string;
}
