import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { trimString } from './product-dto.util';

export class CreateProductDto {
  @IsString()
  @Length(1, 100)
  @Transform(trimString)
  title!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  price!: number;

  @IsString()
  @Length(1, 5000)
  @Transform(trimString)
  description!: string;

  @IsString()
  @Length(1, 50)
  @Transform(trimString)
  category!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Transform(trimString)
  region?: string;
}
