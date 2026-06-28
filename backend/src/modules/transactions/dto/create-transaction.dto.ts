import { IsUUID } from 'class-validator';

export class CreateTransactionDto {
  @IsUUID('4')
  productId!: string;
}
