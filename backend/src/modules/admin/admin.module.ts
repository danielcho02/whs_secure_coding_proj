import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminLogsController } from './admin-logs.controller';
import { AdminProductsController } from './admin-products.controller';
import { AdminReportsController } from './admin-reports.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [JwtModule.register({}), PrismaModule],
  controllers: [
    AdminReportsController,
    AdminProductsController,
    AdminUsersController,
    AdminLogsController,
  ],
  providers: [AdminService],
})
export class AdminModule {}
