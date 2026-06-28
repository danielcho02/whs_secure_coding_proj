import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatsController } from './chats.controller';
import { ChatsGateway } from './chats.gateway';
import { ChatsService } from './chats.service';

@Module({
  imports: [JwtModule.register({}), PrismaModule],
  controllers: [ChatsController],
  providers: [ChatsGateway, ChatsService],
  exports: [ChatsService],
})
export class ChatsModule {}
