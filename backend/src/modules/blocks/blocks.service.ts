import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { ListBlocksDto } from './dto/list-blocks.dto';
import {
  BlockResponse,
  DeleteBlockResponse,
  PaginatedBlocksResponse,
} from './dto/block-response.dto';

const PUBLIC_USER_SELECT = {
  id: true,
  nickname: true,
  avatarUrl: true,
  trustScore: true,
  completedTx: true,
} satisfies Prisma.UserSelect;

const BLOCK_RESPONSE_SELECT = {
  id: true,
  blockerId: true,
  blockedId: true,
  blocked: {
    select: PUBLIC_USER_SELECT,
  },
} satisfies Prisma.BlockSelect;

type BlockRecord = Prisma.BlockGetPayload<{
  select: typeof BLOCK_RESPONSE_SELECT;
}>;

@Injectable()
export class BlocksService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async createBlock(
    blockerId: string,
    dto: CreateBlockDto,
  ): Promise<BlockResponse> {
    const blockedId = dto.blockedUserId;

    if (blockerId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }

    const blockedUser = await this.prisma.user.findUnique({
      where: { id: blockedId },
      select: { id: true, status: true },
    });

    if (!blockedUser || blockedUser.status === UserStatus.WITHDRAWN) {
      throw new NotFoundException('User not found');
    }

    const existingBlock = await this.prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
      select: BLOCK_RESPONSE_SELECT,
    });

    if (existingBlock) {
      return this.toBlockResponse(existingBlock);
    }

    try {
      const block = await this.prisma.block.create({
        data: { blockerId, blockedId },
        select: BLOCK_RESPONSE_SELECT,
      });

      return this.toBlockResponse(block);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const block = await this.prisma.block.findUnique({
          where: {
            blockerId_blockedId: {
              blockerId,
              blockedId,
            },
          },
          select: BLOCK_RESPONSE_SELECT,
        });

        if (block) {
          return this.toBlockResponse(block);
        }
      }

      throw error;
    }
  }

  async deleteBlock(
    blockerId: string,
    blockedId: string,
  ): Promise<DeleteBlockResponse> {
    const where = {
      blockerId_blockedId: {
        blockerId,
        blockedId,
      },
    };

    const existingBlock = await this.prisma.block.findUnique({
      where,
      select: { id: true },
    });

    if (!existingBlock) {
      return { deleted: false };
    }

    await this.prisma.block.delete({
      where,
      select: { id: true },
    });

    return { deleted: true };
  }

  async listBlocks(
    blockerId: string,
    query: ListBlocksDto,
  ): Promise<PaginatedBlocksResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { blockerId };

    const [items, total] = await Promise.all([
      this.prisma.block.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: BLOCK_RESPONSE_SELECT,
      }),
      this.prisma.block.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toBlockResponse(item)),
      page,
      limit,
      total,
    };
  }

  private toBlockResponse(block: BlockRecord): BlockResponse {
    return block;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
