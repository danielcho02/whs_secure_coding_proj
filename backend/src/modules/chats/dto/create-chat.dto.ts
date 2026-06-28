import { IsUUID } from 'class-validator';

export class CreateChatDto {
  @IsUUID('4')
  productId!: string;
}
