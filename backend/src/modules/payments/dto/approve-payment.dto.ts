import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class ApprovePaymentDto {
  @IsString()
  @Length(1, 200)
  paymentKey: string;

  @IsString()
  @Length(6, 100)
  orderId: string;

  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount: number;
}
