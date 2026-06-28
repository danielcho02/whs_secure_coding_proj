import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateReportDto } from './dto/create-report.dto';
import { ListMyReportsDto } from './dto/list-my-reports.dto';
import {
  PaginatedReportsResponse,
  ReportResponse,
} from './dto/report-response.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(
    @Inject(ReportsService)
    private readonly reportsService: ReportsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  createReport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReportDto,
  ): Promise<ReportResponse> {
    return this.reportsService.createReport(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  listMyReports(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMyReportsDto,
  ): Promise<PaginatedReportsResponse> {
    return this.reportsService.listMyReports(user.id, query);
  }
}
