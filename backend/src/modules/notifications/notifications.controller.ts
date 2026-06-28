import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import {
  NotificationResponse,
  PaginatedNotificationsResponse,
} from './dto/notification-response.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  listNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsDto,
  ): Promise<PaginatedNotificationsResponse> {
    return this.notificationsService.listNotifications(user.id, query);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/read')
  @HttpCode(200)
  markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NotificationResponse> {
    return this.notificationsService.markAsRead(user.id, id);
  }
}
