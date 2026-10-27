import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { getDatabase } from '../../db/database';
import { sendNotificationToChannel } from '../notifications/notifier';
import {
  NotificationChannelConfig,
  NotificationChannelDto,
} from '../../types/contract';

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

@Injectable()
export class ChannelsService {
  getChannels(userId: string): NotificationChannelDto[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM notification_channels WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];

    return rows.map(r => {
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
  }

  createChannel(
    userId: string,
    data: { name: string; enabled?: boolean; config: NotificationChannelConfig }
  ): NotificationChannelDto {
    const { name, enabled = true, config } = data;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const db = getDatabase();

    db.prepare(`
      INSERT INTO notification_channels (id, user_id, name, enabled, config, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, name, enabled ? 1 : 0, JSON.stringify(config), now);

    return {
      id,
      userId,
      name,
      enabled,
      config: maskChannelConfig(config),
      createdAt: now,
    };
  }

  updateChannel(
    userId: string,
    channelId: string,
    data: { name?: string; enabled?: boolean; config?: NotificationChannelConfig }
  ): NotificationChannelDto | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM notification_channels WHERE id = ? AND user_id = ?').get(channelId, userId) as any;
    if (!row) {
      return null;
    }

    let existingConfig: any;
    try {
      existingConfig = JSON.parse(row.config);
    } catch {}

    const { name, enabled, config } = data;
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
    return {
      id: updatedRow.id,
      userId: updatedRow.user_id,
      name: updatedRow.name,
      enabled: Boolean(updatedRow.enabled),
      config: maskChannelConfig(parsedCfg),
      createdAt: updatedRow.created_at,
    };
  }

  deleteChannel(userId: string, channelId: string): boolean {
    const db = getDatabase();
    const row = db.prepare('SELECT id FROM notification_channels WHERE id = ? AND user_id = ?').get(channelId, userId);
    if (!row) {
      return false;
    }

    db.prepare('DELETE FROM notification_channels WHERE id = ? AND user_id = ?').run(channelId, userId);
    return true;
  }

  async testChannel(
    userId: string,
    channelId: string,
    baseUrl: string
  ): Promise<{ success: boolean; channelName?: string; error?: string }> {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM notification_channels WHERE id = ? AND user_id = ?').get(channelId, userId) as any;
    if (!row) {
      return { success: false, error: 'NOT_FOUND' };
    }

    let config: NotificationChannelConfig;
    try {
      config = JSON.parse(row.config);
    } catch {
      return { success: false, error: 'INVALID_CONFIG' };
    }

    const channelDto: NotificationChannelDto = {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      enabled: Boolean(row.enabled),
      config,
      createdAt: row.created_at,
    };

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
      return { success: true, channelName: channelDto.name };
    } else {
      return { success: false, error: testResult.error || 'Unknown error' };
    }
  }
}

