import { safeFetch } from '../../../security/ssrfGuard';

export interface LineNotificationParams {
  channelAccessToken: string;
  toUserId: string;
  title: string;
  chapterNumber: number | null;
  chapterTitle: string;
  lastReadChapter: number | null;
  domain: string;
  chapterUrl: string;
  readRedirectUrl: string;
}

export async function sendLineNotification(
  params: LineNotificationParams
): Promise<{ success: boolean; error?: string }> {
  const {
    channelAccessToken,
    toUserId,
    title,
    chapterNumber,
    chapterTitle,
    lastReadChapter,
    domain,
    readRedirectUrl,
  } = params;

  const latestStr = chapterNumber !== null ? `ตอนที่ ${chapterNumber}` : chapterTitle || 'ตอนใหม่';
  const lastReadStr = lastReadChapter !== null ? `ตอนที่ ${lastReadChapter}` : 'ยังไม่ได้เริ่มอ่าน';
  const targetReadUrl = readRedirectUrl || params.chapterUrl;

  const messageText = `🔔 แจ้งเตือนมังงะตอนใหม่!\n\n` +
    `📖 เรื่อง: ${title}\n` +
    `🆕 ตอนใหม่ล่าสุด: ${latestStr}${chapterTitle ? ` (${chapterTitle})` : ''}\n` +
    `🔖 อ่านล่าสุด: ${lastReadStr}\n` +
    `🌐 แหล่งที่มา: ${domain}\n\n` +
    `👉 คลิกอ่านตอนใหม่:\n${targetReadUrl}`;

  try {
    const pushApiUrl = 'https://api.line.me/v2/bot/message/push';
    const res = await safeFetch(pushApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: toUserId,
        messages: [
          {
            type: 'text',
            text: messageText,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errJson = (await res.json().catch(() => ({}))) as any;
      return {
        success: false,
        error: errJson?.message || `LINE API error HTTP ${res.status}`,
      };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

