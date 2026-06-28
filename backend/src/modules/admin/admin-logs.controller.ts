import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AdminLogResponse,
  PaginatedAdminResponse,
} from './dto/admin-response.dto';
import { ListAdminLogsDto } from './dto/list-admin-logs.dto';
import { AdminService } from './admin.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/logs')
export class AdminLogsController {
  constructor(
    @Inject(AdminService)
    private readonly adminService: AdminService,
  ) {}

  @Get()
  listAdminLogs(
    @Query() query: ListAdminLogsDto,
  ): Promise<PaginatedAdminResponse<AdminLogResponse>> {
    return this.adminService.listAdminLogs(query);
  }
}
