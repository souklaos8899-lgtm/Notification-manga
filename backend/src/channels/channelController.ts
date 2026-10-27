import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/database';
import { sendNotificationToChannel } from '../notifications/notifier';
import {
  NotificationChannelConfig,
  NotificationChannelDto,
  NotificationLogDto,
} from '../types/contract';

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

export function maskSecret(secret?: string): string {
  if (!secret) return '';
  if (secret.length <= 8) return '••••••••';
  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
}

export function maskChannelConfig(config: NotificationChannelConfig): NotificationChannelConfig {
  switch (config.kind) {
    case 'telegram':
      return {
        ...config,
        botToken: maskSecret(config.botToken),
      };
    case 'line':
      return {
        ...config,
        channelAccessToken: maskSecret(config.channelAccessToken),
      };
    case 'discord': {
      try {
        const u = new URL(config.webhookUrl);
        const parts = u.pathname.split('/');
        if (parts.length >= 5) {
          parts[4] = maskSecret(parts[4]);
          u.pathname = parts.join('/');
          return {
            ...config,
            webhookUrl: u.toString(),
          };
        }
      } catch {}
      return config;
    }
    case 'webhook':
      return {
        ...config,
        secretHeader: config.secretHeader ? maskSecret(config.secretHeader) : undefined,
      };
    default:
      return config;
  }
}

export async function handleGetChannels(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM notification_channels WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];

  const items: NotificationChannelDto[] = rows.map(r => {
    let cfg: NotificationChannelConfig;
    try {
      cfg = JSON.parse(r.config);
    } catch {
      cfg = { kind: 'telegram', botToken: '', chatId: '' };
    }
    return {
      id: r.id,
      userId: r.user_id,
      name: r.name,
      enabled: Boolean(r.enabled),
      config: maskChannelConfig(cfg),
      createdAt: r.created_at,
    };
  });

  res.json({ items });
}

export async function handleCreateChannel(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const parseResult = createChannelSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0]?.message || 'ข้อมูลการตั้งค่าไม่ถูกต้อง' });
      return;
    }

    const { name, enabled, config } = parseResult.data;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const db = getDatabase();

    db.prepare(`
      INSERT INTO notification_channels (id, user_id, name, enabled, config, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, name, enabled ? 1 : 0, JSON.stringify(config), now);

    const channelDto: NotificationChannelDto = {
      id,
      userId,
      name,
      enabled,
      config: maskChannelConfig(config as NotificationChannelConfig),
      createdAt: now,
    };

    res.status(201).json(channelDto);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'ไม่สามารถเพิ่มช่องทางการแจ้งเตือนได้' });
  }
}

export async function handleUpdateChannel(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const channelId = req.params.id;
    const parseResult = updateChannelSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0]?.message || 'ข้อมูลไม่ถูกต้อง' });
      return;
    }

    const db = getDatabase();
    const row = db.prepare('SELECT * FROM notification_channels WHERE id = ? AND user_id = ?').get(channelId, userId) as any;
    if (!row) {
      res.status(404).json({ error: 'ไม่พบช่องทางแจ้งเตือนที่ระบุ' });
      return;
    }

    let existingConfig: any;
    try {
      existingConfig = JSON.parse(row.config);
    } catch {}

    const { name, enabled, config } = parseResult.data;
    const nextName = name !== undefined ? name : row.name;
    const nextEnabled = enabled !== undefined ? (enabled ? 1 : 0) : row.enabled;

    let nextConfig = row.config;
    if (config !== undefined) {
      const mergedConfig = { ...config } as any;
      if (config.kind === 'telegram' && (config.botToken.includes('••••') || config.botToken === '')) {
        mergedConfig.botToken = existingConfig?.botToken || config.botToken;
      }
      if (config.kind === 'line' && (config.channelAccessToken.includes('••••') || config.channelAccessToken === '')) {
        mergedConfig.channelAccessToken = existingConfig?.channelAccessToken || config.channelAccessToken;
      }
      if (config.kind === 'discord' && config.webhookUrl.includes('••••')) {
        mergedConfig.webhookUrl = existingConfig?.webhookUrl || config.webhookUrl;
      }
      if (config.kind === 'webhook' && config.secretHeader && config.secretHeader.includes('••••')) {
        mergedConfig.secretHeader = existingConfig?.secretHeader;
      }
      nextConfig = JSON.stringify(mergedConfig);
    }

    db.prepare(`
      UPDATE notification_channels
      SET name = ?, enabled = ?, config = ?
      WHERE id = ? AND user_id = ?
    `).run(nextName, nextEnabled, nextConfig, channelId, userId);

    const updatedRow = db.prepare('SELECT * FROM notification_channels WHERE id = ?').get(channelId) as any;
    const parsedCfg = JSON.parse(updatedRow.config);
    res.json({
      id: updatedRow.id,
      userId: updatedRow.user_id,
      name: updatedRow.name,
      enabled: Boolean(updatedRow.enabled),
      config: maskChannelConfig(parsedCfg),
      createdAt: updatedRow.created_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'ไม่สามารถแก้ไขช่องทางแจ้งเตือนได้' });
  }
}

export async function handleDeleteChannel(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const channelId = req.params.id;
    const db = getDatabase();

    const row = db.prepare('SELECT id FROM notification_channels WHERE id = ? AND user_id = ?').get(channelId, userId);
    if (!row) {
      res.status(404).json({ error: 'ไม่พบช่องทางแจ้งเตือนที่ต้องการลบ' });
      return;
    }

    db.prepare('DELETE FROM notification_channels WHERE id = ? AND user_id = ?').run(channelId, userId);
    res.json({ success: true, message: 'ลบช่องทางการแจ้งเตือนเรียบร้อยแล้ว' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'ไม่สามารถลบช่องทางแจ้งเตือนได้' });
  }
}

export async function handleTestChannel(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const channelId = req.params.id;
    const db = getDatabase();

    const row = db.prepare('SELECT * FROM notification_channels WHERE id = ? AND user_id = ?').get(channelId, userId) as any;
    if (!row) {
      res.status(404).json({ error: 'ไม่พบช่องทางแจ้งเตือน' });
      return;
    }

    let config: NotificationChannelConfig;
    try {
      config = JSON.parse(row.config);
    } catch {
      res.status(400).json({ error: 'การตั้งค่าช่องทางไม่ถูกต้อง' });
      return;
    }

    const channelDto: NotificationChannelDto = {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      enabled: Boolean(row.enabled),
      config,
      createdAt: row.created_at,
    };

    const host = req.get('host') || 'localhost:4000';
    const baseUrl = `${req.protocol}://${host}`;

    const testResult = await sendNotificationToChannel(
      channelDto,
      {
        userId,
        mangaId: null,
        mangaTitle: 'ทดสอบระบบแจ้งเตือน (Test Manga)',
        chapterNumber: 999,
        chapterTitle: 'ทดสอบส่งข้อความแจ้งเตือนสำเร็จ',
        chapterUrl: `${baseUrl}/api/demo-manga-page`,
        lastReadChapter: 998,
        domain: 'notification-manga.local',
        coverUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400',
        appBaseUrl: baseUrl,
      },
      `${baseUrl}/api/demo-manga-page`
    );

    if (testResult.success) {
      res.json({ success: true, message: `ส่งข้อความทดสอบไปยัง ${channelDto.name} สำเร็จ!` });
    } else {
      res.status(400).json({
        success: false,
        error: `ส่งข้อความทดสอบไม่สำเร็จ: ${testResult.error || 'Unknown error'}`,
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการทดสอบช่องทาง' });
  }
}

export async function handleGetNotifications(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM notification_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100
  `).all(userId) as any[];

  const items: NotificationLogDto[] = rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    mangaId: r.manga_id,
    mangaTitle: r.manga_title,
    chapterNumber: r.chapter_number !== null ? Number(r.chapter_number) : null,
    chapterTitle: r.chapter_title,
    chapterUrl: r.chapter_url,
    channelName: r.channel_name,
    channelKind: r.channel_kind,
    deliveryStatus: r.delivery_status,
    errorMessage: r.error_message,
    isRead: Boolean(r.is_read),
    createdAt: r.created_at,
  }));

  res.json({ items });
}

export async function handleMarkNotificationRead(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const notificationId = req.params.id;
  const db = getDatabase();

  const row = db.prepare('SELECT id FROM notification_logs WHERE id = ? AND user_id = ?').get(notificationId, userId);
  if (!row) {
    res.status(404).json({ error: 'ไม่พบรายการแจ้งเตือน' });
    return;
  }

  db.prepare('UPDATE notification_logs SET is_read = 1 WHERE id = ? AND user_id = ?').run(notificationId, userId);
  res.json({ success: true, message: 'ทำเครื่องหมายว่าอ่านแล้ว' });
}

export async function handleMarkAllNotificationsRead(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const db = getDatabase();
  db.prepare('UPDATE notification_logs SET is_read = 1 WHERE user_id = ?').run(userId);
  res.json({ success: true, message: 'ทำเครื่องหมายว่าอ่านแล้วทั้งหมดเรียบร้อย' });
}
