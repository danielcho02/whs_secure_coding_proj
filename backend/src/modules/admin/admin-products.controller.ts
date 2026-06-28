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
  AdminProductResponse,
  PaginatedAdminResponse,
} from './dto/admin-response.dto';
import { ListAdminProductsDto } from './dto/list-admin-products.dto';
import { AdminService } from './admin.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/products')
export class AdminProductsController {
  constructor(
    @Inject(AdminService)
    private readonly adminService: AdminService,
  ) {}

  @Get()
  listProducts(
    @Query() query: ListAdminProductsDto,
  ): Promise<PaginatedAdminResponse<AdminProductResponse>> {
    return this.adminService.listProducts(query);
  }

  @Patch(':id/hide')
  hideProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminActionReasonDto,
  ): Promise<AdminProductResponse> {
    return this.adminService.hideProduct(user.id, id, dto);
  }

  @Patch(':id/restore')
  restoreProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminActionReasonDto,
  ): Promise<AdminProductResponse> {
    return this.adminService.restoreProduct(user.id, id, dto);
  }
}
