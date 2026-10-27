import { isSafeHttpUrl } from './urlSecurity';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) {
    return 'denied';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return 'denied';
  }
  try {
    return await Notification.requestPermission();
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return 'denied';
  }
}

export function showBrowserNotification(
  title: string,
  options?: {
    readonly body?: string;
    readonly icon?: string;
    readonly url?: string;
  }
): boolean {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  try {
    const notification = new Notification(title, {
      body: options?.body,
      icon: options?.icon || '/favicon.ico',
    });

    if (options?.url && isSafeHttpUrl(options.url)) {
      const safeUrl = options.url;
      notification.onclick = () => {
        window.focus();
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
        notification.close();
      };
    }
    return true;
  } catch (error) {
    console.error('Failed to display browser notification:', error);
    return false;
  }
}
