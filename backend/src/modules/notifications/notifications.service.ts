import { Injectable } from '@nestjs/common';
import { getDatabase } from '../../db/database';
import { NotificationChannelDto, NotificationLogDto } from '../../types/contract';
import {
  dispatchMangaUpdateNotification,
  DispatchNotificationParams,
  sendNotificationToChannel,
} from './notifier';

@Injectable()
export class NotificationsService {
  async getNotifications(userId: string): Promise<NotificationLogDto[]> {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM notification_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100
    `).all(userId) as any[];

    return rows.map(r => ({
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
  }

  async markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
    const db = getDatabase();
    const row = db.prepare('SELECT id FROM notification_logs WHERE id = ? AND user_id = ?').get(notificationId, userId);
    if (!row) {
      return false;
    }

    db.prepare('UPDATE notification_logs SET is_read = 1 WHERE id = ? AND user_id = ?').run(notificationId, userId);
    return true;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    const db = getDatabase();
    db.prepare('UPDATE notification_logs SET is_read = 1 WHERE user_id = ?').run(userId);
  }

  async sendNotification(
    channel: NotificationChannelDto,
    params: DispatchNotificationParams,
    readRedirectUrl: string
  ) {
    return sendNotificationToChannel(channel, params, readRedirectUrl);
  }

  async dispatchUpdate(params: DispatchNotificationParams) {
    return dispatchMangaUpdateNotification(params);
  }
}

