import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';

@Module({
  imports: [JwtModule.register({}), PrismaModule],
  controllers: [BlocksController],
  providers: [BlocksService],
})
export class BlocksModule {}
