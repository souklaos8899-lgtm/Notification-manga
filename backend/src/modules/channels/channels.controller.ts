import {
  Controller,
  Delete,
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
import { z } from 'zod';
import { AuthGuard } from '../../common/guards';
import { ChannelsService } from './channels.service';

const telegramConfigSchema = z.object({
  kind: z.literal('telegram'),
  botToken: z.string().min(1, 'ต้องระบุ Telegram Bot Token'),
  chatId: z.string().min(1, 'ต้องระบุ Telegram Chat ID'),
});

const discordConfigSchema = z.object({
  kind: z.literal('discord'),
  webhookUrl: z.string().url('ต้องเป็น Discord Webhook URL ที่ถูกต้อง'),
});

const lineConfigSchema = z.object({
  kind: z.literal('line'),
  channelAccessToken: z.string().min(1, 'ต้องระบุ LINE Channel Access Token'),
  toUserId: z.string().min(1, 'ต้องระบุ LINE Target User ID'),
});

const webhookConfigSchema = z.object({
  kind: z.literal('webhook'),
  url: z.string().url('ต้องเป็น Webhook URL ที่ถูกต้อง'),
  secretHeader: z.string().optional(),
});

const channelConfigSchema = z.discriminatedUnion('kind', [
  telegramConfigSchema,
  discordConfigSchema,
  lineConfigSchema,
  webhookConfigSchema,
]);

const createChannelSchema = z.object({
  name: z.string().min(1, 'กรุณาระบุชื่อช่องทางแจ้งเตือน'),
  enabled: z.boolean().optional().default(true),
  config: channelConfigSchema,
});

const updateChannelSchema = z.object({
  name: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  config: channelConfigSchema.optional(),
});

@Controller('api/channels')
@UseGuards(AuthGuard)
export class ChannelsController {
  constructor(
    @Inject(ChannelsService) private readonly channelsService: ChannelsService
  ) {}

  @Get()
  async getChannels(@Req() req: Request, @Res() res: Response): Promise<void> {
    const userId = req.user!.id;
    const items = this.channelsService.getChannels(userId);
    res.status(200).json({ items });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createChannel(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const parseResult = createChannelSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.errors[0]?.message || 'ข้อมูลการตั้งค่าไม่ถูกต้อง' });
        return;
      }

      const created = this.channelsService.createChannel(userId, parseResult.data as any);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'ไม่สามารถเพิ่มช่องทางการแจ้งเตือนได้' });
    }
  }

  @Patch(':id')
  async updateChannel(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const channelId = req.params.id;
      const parseResult = updateChannelSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.errors[0]?.message || 'ข้อมูลไม่ถูกต้อง' });
        return;
      }

      const updated = this.channelsService.updateChannel(userId, channelId, parseResult.data as any);
      if (!updated) {
        res.status(404).json({ error: 'ไม่พบช่องทางแจ้งเตือนที่ระบุ' });
        return;
      }

      res.status(200).json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'ไม่สามารถแก้ไขช่องทางแจ้งเตือนได้' });
    }
  }

  @Delete(':id')
  async deleteChannel(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const channelId = req.params.id;
      const deleted = this.channelsService.deleteChannel(userId, channelId);
      if (!deleted) {
        res.status(404).json({ error: 'ไม่พบช่องทางแจ้งเตือนที่ต้องการลบ' });
        return;
      }

      res.status(200).json({ success: true, message: 'ลบช่องทางการแจ้งเตือนเรียบร้อยแล้ว' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'ไม่สามารถลบช่องทางแจ้งเตือนได้' });
    }
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  async testChannel(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const channelId = req.params.id;
      const host = req.get('host') || 'localhost:4000';
      const baseUrl = `${req.protocol}://${host}`;

      const result = await this.channelsService.testChannel(userId, channelId, baseUrl);
      if (result.error === 'NOT_FOUND') {
        res.status(404).json({ error: 'ไม่พบช่องทางแจ้งเตือน' });
        return;
      }
      if (result.error === 'INVALID_CONFIG') {
        res.status(400).json({ error: 'การตั้งค่าช่องทางไม่ถูกต้อง' });
        return;
      }

      if (result.success) {
        res.status(200).json({ success: true, message: `ส่งข้อความทดสอบไปยัง ${result.channelName} สำเร็จ!` });
      } else {
        res.status(400).json({
          success: false,
          error: `ส่งข้อความทดสอบไม่สำเร็จ: ${result.error || 'Unknown error'}`,
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการทดสอบช่องทาง' });
    }
  }
}

