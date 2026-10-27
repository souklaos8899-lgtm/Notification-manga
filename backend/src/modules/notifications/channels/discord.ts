import { assertSafeUrl, safeFetch } from '../../../security/ssrfGuard';

export interface DiscordNotificationParams {
  webhookUrl: string;
  title: string;
  chapterNumber: number | null;
  chapterTitle: string;
  lastReadChapter: number | null;
  domain: string;
  chapterUrl: string;
  readRedirectUrl: string;
  coverUrl: string | null;
}

export async function sendDiscordNotification(
  params: DiscordNotificationParams
): Promise<{ success: boolean; error?: string }> {
  const {
    webhookUrl,
    title,
    chapterNumber,
    chapterTitle,
    lastReadChapter,
    domain,
    readRedirectUrl,
    coverUrl,
  } = params;

  try {
    await assertSafeUrl(webhookUrl);

    const latestStr = chapterNumber !== null ? `ตอนที่ ${chapterNumber}` : chapterTitle || 'ตอนใหม่';
    const lastReadStr = lastReadChapter !== null ? `ตอนที่ ${lastReadChapter}` : 'ยังไม่ได้เริ่มอ่าน';
    const targetReadUrl = readRedirectUrl || params.chapterUrl;

    const payload = {
      content: '🔔 **แจ้งเตือนมังงะตอนใหม่!**',
      embeds: [
        {
          title: `📖 ${title}`,
          url: targetReadUrl,
          color: 0x5865f2,
          description: `มีตอนใหม่ถูกอัปเดตแล้วในเว็บ **${domain}**!`,
          thumbnail: coverUrl && coverUrl.startsWith('http') ? { url: coverUrl } : undefined,
          fields: [
            {
              name: '🆕 ตอนใหม่ล่าสุด',
              value: `${latestStr}${chapterTitle ? `\n_${chapterTitle}_` : ''}`,
              inline: true,
            },
            {
              name: '🔖 ตอนที่อ่านล่าสุด',
              value: lastReadStr,
              inline: true,
            },
            {
              name: '🌐 แหล่งที่มา',
              value: `[${domain}](${targetReadUrl})`,
              inline: false,
            },
          ],
          footer: {
            text: 'Notification Manga System',
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const res = await safeFetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        success: false,
        error: `Discord Webhook error HTTP ${res.status}: ${errText.slice(0, 100)}`,
      };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

