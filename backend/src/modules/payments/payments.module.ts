import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from '../../config/configuration';
import { PrismaModule } from '../prisma/prisma.module';
import { PAYMENTS_CONFIG, PaymentsConfig } from './payments.config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import { TossPaymentsProvider } from './providers/toss-payments.provider';
import { TossWebhookVerifier } from './toss-webhook-verifier';

@Module({
  imports: [JwtModule.register({}), PrismaModule],
  controllers: [PaymentsController],
  providers: [
    {
      provide: PAYMENTS_CONFIG,
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<AppConfig, true>,
      ): PaymentsConfig => configService.get('payments', { infer: true }),
    },
    TossPaymentsProvider,
    {
      provide: PAYMENT_PROVIDER,
      useExisting: TossPaymentsProvider,
    },
    {
      provide: TossWebhookVerifier,
      inject: [PAYMENTS_CONFIG],
      useFactory: (paymentsConfig: PaymentsConfig): TossWebhookVerifier =>
        new TossWebhookVerifier(paymentsConfig.webhookSecret),
    },
    PaymentsService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
