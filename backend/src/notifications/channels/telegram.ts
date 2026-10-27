import { safeFetch } from '../../security/ssrfGuard';

export interface TelegramNotificationParams {
  botToken: string;
  chatId: string;
  title: string;
  chapterNumber: number | null;
  chapterTitle: string;
  lastReadChapter: number | null;
  domain: string;
  chapterUrl: string;
  readRedirectUrl: string;
  coverUrl: string | null;
}

export async function sendTelegramNotification(
  params: TelegramNotificationParams
): Promise<{ success: boolean; error?: string }> {
  const {
    botToken,
    chatId,
    title,
    chapterNumber,
    chapterTitle,
    lastReadChapter,
    domain,
    readRedirectUrl,
    coverUrl,
  } = params;

  const latestStr = chapterNumber !== null ? `ตอนที่ ${chapterNumber}` : chapterTitle || 'ตอนใหม่';
  const lastReadStr = lastReadChapter !== null ? `ตอนที่ ${lastReadChapter}` : 'ยังไม่ได้เริ่มอ่าน';
  const targetReadUrl = readRedirectUrl || params.chapterUrl;

  const captionHtml = `🔔 <b>แจ้งเตือนมังงะตอนใหม่!</b>

📖 <b>เรื่อง:</b> ${escapeHtml(title)}
🆕 <b>ตอนใหม่ล่าสุด:</b> ${escapeHtml(latestStr)} ${chapterTitle ? `(${escapeHtml(chapterTitle)})` : ''}
🔖 <b>ตอนที่อ่านล่าสุด:</b> ${escapeHtml(lastReadStr)}
🌐 <b>แหล่งที่มา:</b> ${escapeHtml(domain)}

👉 <a href="${escapeHtml(targetReadUrl)}"><b>คลิกเพื่ออ่านตอนใหม่ทันที</b></a>`;

  // Try sendPhoto if coverUrl is available
  if (coverUrl && coverUrl.startsWith('http')) {
    try {
      const photoApiUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
      const res = await safeFetch(photoApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: coverUrl,
          caption: captionHtml,
          parse_mode: 'HTML',
        }),
      });

      if (res.ok) {
        return { success: true };
      }
    } catch {
      // Fallback to text message
    }
  }

  // Fallback or text-only message
  try {
    const textApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await safeFetch(textApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: captionHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    const body = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      return {
        success: false,
        error: body?.description || `Telegram API error HTTP ${res.status}`,
      };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
