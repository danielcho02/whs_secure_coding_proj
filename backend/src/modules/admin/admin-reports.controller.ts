import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AdminReportResponse,
  PaginatedAdminResponse,
} from './dto/admin-response.dto';
import { ListAdminReportsDto } from './dto/list-admin-reports.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { AdminService } from './admin.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/reports')
export class AdminReportsController {
  constructor(
    @Inject(AdminService)
    private readonly adminService: AdminService,
  ) {}

  @Get()
  listReports(
    @Query() query: ListAdminReportsDto,
  ): Promise<PaginatedAdminResponse<AdminReportResponse>> {
    return this.adminService.listReports(query);
  }

  @Get(':id')
  getReport(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminReportResponse> {
    return this.adminService.getReport(id);
  }

  @Patch(':id/status')
  updateReportStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportStatusDto,
  ): Promise<AdminReportResponse> {
    return this.adminService.updateReportStatus(user.id, id, dto);
  }
}
