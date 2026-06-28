import { IsOptional, IsString, Length } from 'class-validator';

export class RefundPaymentDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  reason?: string;
}
