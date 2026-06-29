import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CancelTransactionDto } from './dto/cancel-transaction.dto';
import { CompleteTransactionDto } from './dto/complete-transaction.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import { ReserveTransactionDto } from './dto/reserve-transaction.dto';
import {
  PaginatedTransactionsResponse,
  ReviewResponse,
  TransactionResponse,
} from './dto/transaction-response.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(
    @Inject(TransactionsService)
    private readonly transactionsService: TransactionsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  createTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionResponse> {
    return this.transactionsService.createTransaction(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/reserve')
  reserveTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReserveTransactionDto,
  ): Promise<TransactionResponse> {
    void dto;
    return this.transactionsService.reserveTransaction(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  cancelTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CancelTransactionDto,
  ): Promise<TransactionResponse> {
    void dto;
    return this.transactionsService.cancelTransaction(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/complete')
  completeTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompleteTransactionDto,
  ): Promise<TransactionResponse> {
    void dto;
    return this.transactionsService.completeTransaction(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  listTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTransactionsDto,
  ): Promise<PaginatedTransactionsResponse> {
    return this.transactionsService.listTransactions(user.id, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransactionResponse> {
    return this.transactionsService.getTransactionForParticipant(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reviews')
  createReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResponse> {
    return this.transactionsService.createReview(id, user.id, dto);
  }
}
