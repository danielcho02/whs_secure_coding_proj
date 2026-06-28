import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { ListProductsDto } from './list-products.dto';
import { trimString } from './product-dto.util';

export class SearchProductsDto extends ListProductsDto {
  @IsString()
  @Length(1, 100)
  @Transform(trimString)
  q!: string;
}
