import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { optionalBoolean, optionalInteger } from './notification-dto.util';

export class ListNotificationsDto {
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

  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  unreadOnly?: boolean;
}
