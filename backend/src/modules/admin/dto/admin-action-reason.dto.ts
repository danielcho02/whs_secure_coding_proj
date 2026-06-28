import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';
import { trimString } from './admin-dto.util';

export class AdminActionReasonDto {
  @IsOptional()
  @IsString()
  @Length(1, 500)
  @Transform(trimString)
  reason?: string;
}
