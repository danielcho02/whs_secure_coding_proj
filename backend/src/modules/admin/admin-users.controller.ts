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
import { AdminActionReasonDto } from './dto/admin-action-reason.dto';
import {
  AdminUserResponse,
  PaginatedAdminResponse,
} from './dto/admin-response.dto';
import { ListAdminUsersDto } from './dto/list-admin-users.dto';
import { AdminService } from './admin.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    @Inject(AdminService)
    private readonly adminService: AdminService,
  ) {}

  @Get()
  listUsers(
    @Query() query: ListAdminUsersDto,
  ): Promise<PaginatedAdminResponse<AdminUserResponse>> {
    return this.adminService.listUsers(query);
  }

  @Patch(':id/suspend')
  suspendUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminActionReasonDto,
  ): Promise<AdminUserResponse> {
    return this.adminService.suspendUser(user.id, id, dto);
  }

  @Patch(':id/restore')
  restoreUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminActionReasonDto,
  ): Promise<AdminUserResponse> {
    return this.adminService.restoreUser(user.id, id, dto);
  }
}
