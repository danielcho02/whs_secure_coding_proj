import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  BlockResponse,
  DeleteBlockResponse,
  PaginatedBlocksResponse,
} from './dto/block-response.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { ListBlocksDto } from './dto/list-blocks.dto';
import { BlocksService } from './blocks.service';

@Controller('blocks')
export class BlocksController {
  constructor(
    @Inject(BlocksService)
    private readonly blocksService: BlocksService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  createBlock(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBlockDto,
  ): Promise<BlockResponse> {
    return this.blocksService.createBlock(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':blockedUserId')
  deleteBlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('blockedUserId', ParseUUIDPipe) blockedUserId: string,
  ): Promise<DeleteBlockResponse> {
    return this.blocksService.deleteBlock(user.id, blockedUserId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  listBlocks(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListBlocksDto,
  ): Promise<PaginatedBlocksResponse> {
    return this.blocksService.listBlocks(user.id, query);
  }
}
