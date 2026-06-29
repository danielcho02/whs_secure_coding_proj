import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ListFavoritesDto } from './dto/list-favorites.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { PaginatedProductsResponse } from '../products/types/product-response.type';

const PRIVATE_USER_SELECT = {
  id: true,
  email: true,
  nickname: true,
  bio: true,
  avatarUrl: true,
  phone: true,
  role: true,
  status: true,
  trustScore: true,
  completedTx: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const PUBLIC_USER_WITH_STATUS_SELECT = {
  id: true,
  nickname: true,
  bio: true,
  avatarUrl: true,
  trustScore: true,
  completedTx: true,
  createdAt: true,
  status: true,
} satisfies Prisma.UserSelect;

const PUBLIC_SELLER_SELECT = {
  id: true,
  nickname: true,
  avatarUrl: true,
  trustScore: true,
  completedTx: true,
} satisfies Prisma.UserSelect;

const PRODUCT_IMAGE_SELECT = {
  id: true,
  url: true,
  order: true,
} satisfies Prisma.ProductImageSelect;

const FAVORITE_PRODUCT_SELECT = {
  id: true,
  title: true,
  description: true,
  price: true,
  category: true,
  region: true,
  status: true,
  viewCount: true,
  createdAt: true,
  seller: { select: PUBLIC_SELLER_SELECT },
  images: {
    select: PRODUCT_IMAGE_SELECT,
    orderBy: { order: 'asc' },
  },
} satisfies Prisma.ProductSelect;

type PrivateUser = Prisma.UserGetPayload<{ select: typeof PRIVATE_USER_SELECT }>;
type PublicUserWithStatus = Prisma.UserGetPayload<{
  select: typeof PUBLIC_USER_WITH_STATUS_SELECT;
}>;
type PublicUser = Omit<PublicUserWithStatus, 'status'>;

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getMe(userId: string): Promise<PrivateUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PRIVATE_USER_SELECT,
    });

    if (!user || user.status === UserStatus.WITHDRAWN) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<PrivateUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });

    if (!user || user.status === UserStatus.WITHDRAWN) {
      throw new NotFoundException('User not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('User is not active');
    }

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: this.toProfileUpdateData(dto),
        select: PRIVATE_USER_SELECT,
      });
    } catch (error) {
      this.throwConflictForUniqueViolation(error);
      throw error;
    }
  }

  async getPublicProfile(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PUBLIC_USER_WITH_STATUS_SELECT,
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new NotFoundException('User not found');
    }

    return this.toPublicUser(user);
  }

  async getPrivateProfile(
    userId: string,
    requester: AuthenticatedUser,
  ): Promise<PrivateUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PRIVATE_USER_SELECT,
    });

    if (!user || user.status === UserStatus.WITHDRAWN) {
      throw new NotFoundException('User not found');
    }

    if (requester.id !== userId && requester.role !== Role.ADMIN) {
      throw new ForbiddenException('Access denied');
    }

    return user;
  }

  async listMyFavorites(
    userId: string,
    query: ListFavoritesDto,
  ): Promise<PaginatedProductsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.FavoriteWhereInput = {
      userId,
      product: { isHidden: false },
    };

    const [favorites, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          product: {
            select: FAVORITE_PRODUCT_SELECT,
          },
        },
      }),
      this.prisma.favorite.count({ where }),
    ]);

    return {
      items: favorites.map((favorite) => favorite.product),
      page,
      limit,
      total,
    };
  }

  private toProfileUpdateData(dto: UpdateMeDto): Prisma.UserUpdateInput {
    return {
      ...(dto.nickname !== undefined ? { nickname: dto.nickname } : {}),
      ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
      ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
    };
  }

  private toPublicUser(user: PublicUserWithStatus): PublicUser {
    return {
      id: user.id,
      nickname: user.nickname,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      trustScore: user.trustScore,
      completedTx: user.completedTx,
      createdAt: user.createdAt,
    };
  }

  private throwConflictForUniqueViolation(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('User already exists');
    }
  }
}
