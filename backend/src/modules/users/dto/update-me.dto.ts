import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @Length(2, 30)
  @Transform(({ value }) => trimString(value))
  nickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => trimString(value))
  bio?: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  @Transform(({ value }) => trimString(value))
  avatarUrl?: string;
}
