import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';
import { optionalTrimmedString, trimString } from './chat-dto.util';

export class SendMessageDto {
  @IsString()
  @Length(1, 2000)
  @Transform(trimString)
  content!: string;

  @IsOptional()
  @IsString()
  @Length(1, 2048)
  @Transform(optionalTrimmedString)
  imageUrl?: string;
}
