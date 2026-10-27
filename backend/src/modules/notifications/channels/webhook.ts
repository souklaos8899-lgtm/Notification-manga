import { assertSafeUrl, safeFetch } from '../../../security/ssrfGuard';

export interface CustomWebhookParams {
  url: string;
  secretHeader?: string;
  payload: Record<string, any>;
}

export async function sendCustomWebhookNotification(
  params: CustomWebhookParams
): Promise<{ success: boolean; error?: string }> {
  const { url, secretHeader, payload } = params;

  try {
    await assertSafeUrl(url);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'NotificationMangaWebhook/1.0',
    };

    if (secretHeader) {
      headers['X-Webhook-Secret'] = secretHeader;
    }

    const res = await safeFetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        success: false,
        error: `Webhook returned HTTP ${res.status}: ${errText.slice(0, 100)}`,
      };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

