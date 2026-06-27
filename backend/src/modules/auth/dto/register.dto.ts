import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

function trimLowercase(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) => trimLowercase(value))
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'password must include uppercase, lowercase, number, and special character',
  })
  password!: string;

  @IsString()
  @Length(2, 30)
  @Transform(({ value }) => trimString(value))
  nickname!: string;
}
