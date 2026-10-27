import type { ReadingStatus } from '../types';

export function formatChapterLabel(chapter: number | null | undefined, fallback = 'ยังไม่มีข้อมูล'): string {
  if (chapter === null || chapter === undefined) {
    return fallback;
  }
  return `ตอนที่ ${chapter}`;
}

export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return 'ไม่มีบันทึกเวลา';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 0) return 'เมื่อสักครู่';
  if (diffInSeconds < 60) return `${diffInSeconds} วินาทีที่แล้ว`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} นาทีที่แล้ว`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} ชั่วโมงที่แล้ว`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'เมื่อวานนี้';
  if (diffInDays < 30) return `${diffInDays} วันที่แล้ว`;

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths} เดือนที่แล้ว`;

  return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function cleanDomainName(rawUrlOrDomain: string): string {
  try {
    const url = rawUrlOrDomain.startsWith('http://') || rawUrlOrDomain.startsWith('https://')
      ? rawUrlOrDomain
      : `https://${rawUrlOrDomain}`;
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return rawUrlOrDomain.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').split('/')[0] || rawUrlOrDomain;
  }
}

export function getStatusBadgeInfo(status: ReadingStatus): {
  readonly label: string;
  readonly bgClass: string;
  readonly textClass: string;
  readonly borderClass: string;
} {
  switch (status) {
    case 'READING':
      return {
        label: 'กำลังอ่าน',
        bgClass: 'bg-emerald-950/60',
        textClass: 'text-emerald-400',
        borderClass: 'border-emerald-700/60',
      };
    case 'ON_HOLD':
      return {
        label: 'ดองไว้',
        bgClass: 'bg-amber-950/60',
        textClass: 'text-amber-400',
        borderClass: 'border-amber-700/60',
      };
    case 'PLAN_TO_READ':
      return {
        label: 'วางแผนจะอ่าน',
        bgClass: 'bg-blue-950/60',
        textClass: 'text-blue-400',
        borderClass: 'border-blue-700/60',
      };
    case 'COMPLETED':
      return {
        label: 'อ่านจบแล้ว',
        bgClass: 'bg-purple-950/60',
        textClass: 'text-purple-400',
        borderClass: 'border-purple-700/60',
      };
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
