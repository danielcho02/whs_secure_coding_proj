import { Role, UserStatus } from '@prisma/client';

export class AuthUserResponseDto {
  id!: string;
  email!: string;
  nickname!: string;
  role!: Role;
  status!: UserStatus;
  createdAt!: Date;
}

export class AuthResponseDto {
  accessToken!: string;
  user!: AuthUserResponseDto;
}
