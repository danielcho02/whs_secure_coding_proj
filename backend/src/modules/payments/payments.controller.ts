import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApprovePaymentDto } from './dto/approve-payment.dto';
import { ConfirmPurchaseDto } from './dto/confirm-purchase.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import {
  PaymentReceiptResponse,
  PaymentResponse,
  PaymentWebhookResult,
} from './dto/payment-response.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentsService } from './payments.service';

interface RawBodyRequest {
  rawBody?: Buffer;
  body?: unknown;
}

@Controller('payments')
export class PaymentsController {
  constructor(
    @Inject(PaymentsService)
    private readonly paymentsService: PaymentsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  createPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentDto,
  ): Promise<PaymentResponse> {
    return this.paymentsService.createPayment(user.id, dto);
  }

  @Post('webhook')
  handleWebhook(
    @Req() request: RawBodyRequest,
    @Body() body: unknown,
    @Headers('x-toss-signature') xTossSignature: string | undefined,
    @Headers('x-toss-timestamp') xTossTimestamp: string | undefined,
    @Headers('tosspayments-webhook-signature')
    tossPaymentsSignature: string | undefined,
    @Headers('tosspayments-webhook-transmission-time')
    tossPaymentsTransmissionTime: string | undefined,
  ): Promise<PaymentWebhookResult> {
    const rawBody =
      request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? body));

    return this.paymentsService.handleWebhook(
      rawBody,
      {
        signature: tossPaymentsSignature ?? xTossSignature ?? null,
        timestamp: tossPaymentsTransmissionTime ?? xTossTimestamp ?? null,
      },
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/approve')
  approvePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApprovePaymentDto,
  ): Promise<PaymentResponse> {
    return this.paymentsService.approvePayment(user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/confirm')
  confirmPurchase(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmPurchaseDto,
  ): Promise<PaymentResponse> {
    void dto;
    return this.paymentsService.confirmPurchase(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/refund')
  refundPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RefundPaymentDto,
  ): Promise<PaymentResponse> {
    return this.paymentsService.refundPayment(user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/receipt')
  getReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaymentReceiptResponse> {
    return this.paymentsService.getReceipt(user.id, id);
  }
}
