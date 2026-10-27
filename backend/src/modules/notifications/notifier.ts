import crypto from 'node:crypto';
import { getDatabase } from '../../db/database';
import { NotificationChannelDto, NotificationLogDto } from '../../types/contract';
import { sendDiscordNotification } from './channels/discord';
import { sendLineNotification } from './channels/line';
import { sendTelegramNotification } from './channels/telegram';
import { sendCustomWebhookNotification } from './channels/webhook';

export interface DispatchNotificationParams {
  userId: string;
  mangaId: string | null;
  mangaTitle: string;
  chapterNumber: number | null;
  chapterTitle: string;
  chapterUrl: string;
  lastReadChapter: number | null;
  domain: string;
  coverUrl: string | null;
  appBaseUrl?: string;
}

export async function sendNotificationToChannel(
  channel: NotificationChannelDto,
  params: DispatchNotificationParams,
  readRedirectUrl: string
): Promise<{ success: boolean; error?: string }> {
  const config = channel.config;

  switch (config.kind) {
    case 'telegram':
      return sendTelegramNotification({
        botToken: config.botToken,
        chatId: config.chatId,
        title: params.mangaTitle,
        chapterNumber: params.chapterNumber,
        chapterTitle: params.chapterTitle,
        lastReadChapter: params.lastReadChapter,
        domain: params.domain,
        chapterUrl: params.chapterUrl,
        readRedirectUrl,
        coverUrl: params.coverUrl,
      });

    case 'discord':
      return sendDiscordNotification({
        webhookUrl: config.webhookUrl,
        title: params.mangaTitle,
        chapterNumber: params.chapterNumber,
        chapterTitle: params.chapterTitle,
        lastReadChapter: params.lastReadChapter,
        domain: params.domain,
        chapterUrl: params.chapterUrl,
        readRedirectUrl,
        coverUrl: params.coverUrl,
      });

    case 'line':
      return sendLineNotification({
        channelAccessToken: config.channelAccessToken,
        toUserId: config.toUserId,
        title: params.mangaTitle,
        chapterNumber: params.chapterNumber,
        chapterTitle: params.chapterTitle,
        lastReadChapter: params.lastReadChapter,
        domain: params.domain,
        chapterUrl: params.chapterUrl,
        readRedirectUrl,
      });

    case 'webhook':
      return sendCustomWebhookNotification({
        url: config.url,
        secretHeader: config.secretHeader,
        payload: {
          event: 'new_chapter_detected',
          userId: params.userId,
          mangaId: params.mangaId,
          mangaTitle: params.mangaTitle,
          chapterNumber: params.chapterNumber,
          chapterTitle: params.chapterTitle,
          chapterUrl: params.chapterUrl,
          readRedirectUrl,
          lastReadChapter: params.lastReadChapter,
          domain: params.domain,
          coverUrl: params.coverUrl,
          timestamp: new Date().toISOString(),
        },
      });

    default:
      return { success: false, error: 'Unknown notification channel kind' };
  }
}

export async function dispatchMangaUpdateNotification(
  params: DispatchNotificationParams
): Promise<{ channelCount: number; successCount: number; failCount: number }> {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Construct 1-click read redirect URL
  const baseUrl = params.appBaseUrl || 'http://localhost:4000';
  const encodedUrl = encodeURIComponent(params.chapterUrl);
  const chParam = params.chapterNumber !== null ? `&chapter=${params.chapterNumber}` : '';
  const readRedirectUrl = params.mangaId
    ? `${baseUrl}/api/read/${params.mangaId}?url=${encodedUrl}${chParam}`
    : params.chapterUrl;

  // 1. Always create in-app notification
  const inAppLogId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO notification_logs (
      id, user_id, manga_id, manga_title, chapter_number, chapter_title,
      chapter_url, channel_name, channel_kind, delivery_status, error_message, is_read, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    inAppLogId,
    params.userId,
    params.mangaId,
    params.mangaTitle,
    params.chapterNumber,
    params.chapterTitle,
    params.chapterUrl,
    'In-App Notification',
    'in_app',
    'sent',
    null,
    0,
    now
  );

  // 2. Fetch enabled external channels for this user
  const channelRows = db.prepare(`
    SELECT * FROM notification_channels WHERE user_id = ? AND enabled = 1
  `).all(params.userId) as any[];

  let successCount = 0;
  let failCount = 0;

  for (const row of channelRows) {
    let configObj: any;
    try {
      configObj = JSON.parse(row.config);
    } catch {
      continue;
    }

    const channelDto: NotificationChannelDto = {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      enabled: Boolean(row.enabled),
      config: configObj,
      createdAt: row.created_at,
    };

    const result = await sendNotificationToChannel(channelDto, params, readRedirectUrl);
    const logId = crypto.randomUUID();

    if (result.success) {
      successCount++;
      db.prepare(`
        INSERT INTO notification_logs (
          id, user_id, manga_id, manga_title, chapter_number, chapter_title,
          chapter_url, channel_name, channel_kind, delivery_status, error_message, is_read, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        logId,
        params.userId,
        params.mangaId,
        params.mangaTitle,
        params.chapterNumber,
        params.chapterTitle,
        params.chapterUrl,
        channelDto.name,
        channelDto.config.kind,
        'sent',
        null,
        0,
        now
      );
    } else {
      failCount++;
      db.prepare(`
        INSERT INTO notification_logs (
          id, user_id, manga_id, manga_title, chapter_number, chapter_title,
          chapter_url, channel_name, channel_kind, delivery_status, error_message, is_read, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        logId,
        params.userId,
        params.mangaId,
        params.mangaTitle,
        params.chapterNumber,
        params.chapterTitle,
        params.chapterUrl,
        channelDto.name,
        channelDto.config.kind,
        'failed',
        result.error || 'Unknown error',
        0,
        now
      );
    }
  }

  return {
    channelCount: channelRows.length,
    successCount,
    failCount,
  };
}

