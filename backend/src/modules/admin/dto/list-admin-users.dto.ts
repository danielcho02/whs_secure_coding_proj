import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Role, UserStatus } from '@prisma/client';
import { optionalInteger, trimString } from './admin-dto.util';

export class ListAdminUsersDto {
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
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  @Transform(trimString)
  q?: string;
}
