export function isSafeHttpUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function sanitizeExternalUrl(url?: string | null): string {
  if (!url) return '#';
  const trimmed = url.trim();
  if (isSafeHttpUrl(trimmed)) {
    return trimmed;
  }
  return '#';
}

