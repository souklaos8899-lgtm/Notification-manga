import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '../../common/guards';
import { NotificationsService } from './notifications.service';

@Controller('api/notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService
  ) {}

  @Get()
  async getNotifications(@Req() req: Request, @Res() res: Response): Promise<void> {
    const userId = req.user!.id;
    const items = await this.notificationsService.getNotifications(userId);
    res.status(200).json({ items });
  }

  @Patch(':id/read')
  async patchNotificationRead(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.handleMarkRead(req, res);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  async postNotificationRead(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.handleMarkRead(req, res);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  async markReadAll(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.handleMarkAllRead(req, res);
  }

  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  async markAllNotificationsRead(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.handleMarkAllRead(req, res);
  }

  private async handleMarkRead(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const notificationId = req.params.id;
    const ok = await this.notificationsService.markNotificationRead(userId, notificationId);
    if (!ok) {
      res.status(404).json({ error: 'ไม่พบรายการแจ้งเตือน' });
      return;
    }
    res.status(200).json({ success: true, message: 'ทำเครื่องหมายว่าอ่านแล้ว' });
  }

  private async handleMarkAllRead(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    await this.notificationsService.markAllNotificationsRead(userId);
    res.status(200).json({ success: true, message: 'ทำเครื่องหมายว่าอ่านแล้วทั้งหมดเรียบร้อย' });
  }
}

