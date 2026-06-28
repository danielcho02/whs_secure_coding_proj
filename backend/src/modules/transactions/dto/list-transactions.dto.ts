import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TxStatus } from '@prisma/client';
import { optionalInteger } from './transaction-dto.util';

export const TRANSACTION_ROLE_VALUES = ['buyer', 'seller', 'all'] as const;
export type TransactionRole = (typeof TRANSACTION_ROLE_VALUES)[number];

export class ListTransactionsDto {
  @IsOptional()
  @IsIn(TRANSACTION_ROLE_VALUES)
  role: TransactionRole = 'all';

  @IsOptional()
  @IsEnum(TxStatus)
  status?: TxStatus;

  @IsOptional()
  @Transform(optionalInteger)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(optionalInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
