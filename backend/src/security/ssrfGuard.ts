import dns from 'node:dns/promises';
import { Agent } from 'undici';

export class SsrfSecurityError extends Error {
  constructor(message: string) {
    super(`SSRF Protection Blocked: ${message}`);
    this.name = 'SsrfSecurityError';
  }
}

export function parseIPv4ToBytes(ip: string): [number, number, number, number] | null {
  const trimmed = ip.trim().replace(/^\[|\]$/g, '');
  const parts = trimmed.split('.');
  if (parts.length < 1 || parts.length > 4) return null;

  const numbers: number[] = [];
  for (const part of parts) {
    let num: number;
    if (/^0x[0-9a-f]+$/i.test(part)) {
      num = parseInt(part, 16);
    } else if (/^0[0-7]+$/.test(part)) {
      num = parseInt(part, 8);
    } else if (/^\d+$/.test(part)) {
      num = parseInt(part, 10);
    } else {
      return null;
    }
    if (isNaN(num) || num < 0) return null;
    numbers.push(num);
  }

  let fullInt: number;
  if (numbers.length === 4) {
    if (numbers.some(n => n > 255)) return null;
    return [numbers[0], numbers[1], numbers[2], numbers[3]];
  } else if (numbers.length === 3) {
    if (numbers[0] > 255 || numbers[1] > 255 || numbers[2] > 65535) return null;
    fullInt = numbers[0] * 16777216 + numbers[1] * 65536 + numbers[2];
  } else if (numbers.length === 2) {
    if (numbers[0] > 255 || numbers[1] > 16777215) return null;
    fullInt = numbers[0] * 16777216 + numbers[1];
  } else {
    if (numbers[0] > 4294967295) return null;
    fullInt = numbers[0];
  }

  const a = Math.floor(fullInt / 16777216) & 0xff;
  const b = Math.floor((fullInt % 16777216) / 65536) & 0xff;
  const c = Math.floor((fullInt % 65536) / 256) & 0xff;
  const d = fullInt & 0xff;
  return [a, b, c, d];
}

export function isPrivateIPv4Bytes(a: number, b: number, c: number, d: number): boolean {
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 192 && b === 88 && c === 99) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;
  return false;
}

export function isPrivateIPv4(ip: string): boolean {
  const bytes = parseIPv4ToBytes(ip);
  if (!bytes) return true;
  return isPrivateIPv4Bytes(bytes[0], bytes[1], bytes[2], bytes[3]);
}

export function parseIPv6ToWords(ip: string): number[] | null {
  let cleaned = ip.trim().replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
  let ipv4Words: number[] | null = null;
  const lastColon = cleaned.lastIndexOf(':');
  if (lastColon !== -1) {
    const afterColon = cleaned.slice(lastColon + 1);
    if (afterColon.includes('.')) {
      const v4Bytes = parseIPv4ToBytes(afterColon);
      if (!v4Bytes) return null;
      ipv4Words = [(v4Bytes[0] << 8) | v4Bytes[1], (v4Bytes[2] << 8) | v4Bytes[3]];
      cleaned = cleaned.slice(0, lastColon);
    }
  }

  const parts = cleaned.split('::');
  if (parts.length > 2) return null;
  const targetLen = ipv4Words ? 6 : 8;
  let words: number[] = [];

  if (parts.length === 2) {
    const head = parts[0] ? parts[0].split(':').map(x => parseInt(x, 16)) : [];
    const tail = parts[1] ? parts[1].split(':').map(x => parseInt(x, 16)) : [];
    if (head.some(isNaN) || tail.some(isNaN)) return null;
    const zeroes = targetLen - head.length - tail.length;
    if (zeroes < 0) return null;
    words = [...head, ...Array(zeroes).fill(0), ...tail];
  } else {
    words = cleaned.split(':').map(x => parseInt(x, 16));
    if (words.some(isNaN)) return null;
  }

  if (ipv4Words) words.push(...ipv4Words);
  if (words.length !== 8 || words.some(w => isNaN(w) || w < 0 || w > 0xffff)) return null;
  return words;
}

export function isPrivateIPv6Words(w: number[]): boolean {
  if (w.every(x => x === 0)) return true;
  if (w.slice(0, 7).every(x => x === 0) && w[7] === 1) return true;

  if (w.slice(0, 5).every(x => x === 0) && w[5] === 0xffff) {
    const a = (w[6] >> 8) & 0xff;
    const b = w[6] & 0xff;
    const c = (w[7] >> 8) & 0xff;
    const d = w[7] & 0xff;
    return isPrivateIPv4Bytes(a, b, c, d);
  }

  if (w.slice(0, 6).every(x => x === 0) && (w[6] !== 0 || w[7] > 1)) {
    const a = (w[6] >> 8) & 0xff;
    const b = w[6] & 0xff;
    const c = (w[7] >> 8) & 0xff;
    const d = w[7] & 0xff;
    return isPrivateIPv4Bytes(a, b, c, d);
  }

  if ((w[0] & 0xfe00) === 0xfc00) return true;
  if ((w[0] & 0xffc0) === 0xfe80) return true;
  if ((w[0] & 0xffc0) === 0xfec0) return true;
  if ((w[0] & 0xff00) === 0xff00) return true;
  if (w[0] === 0x2001 && w[1] === 0x0db8) return true;
  if (w[0] === 0x0100 && w[1] === 0 && w[2] === 0 && w[3] === 0) return true;

  return false;
}

export function isPrivateIPv6(ip: string): boolean {
  const words = parseIPv6ToWords(ip);
  if (!words) return true;
  return isPrivateIPv6Words(words);
}

export function isPrivateIp(ip: string): boolean {
  const stripped = ip.trim().replace(/^\[|\]$/g, '');
  const v4Bytes = parseIPv4ToBytes(stripped);
  if (v4Bytes) {
    return isPrivateIPv4Bytes(v4Bytes[0], v4Bytes[1], v4Bytes[2], v4Bytes[3]);
  }
  const v6Words = parseIPv6ToWords(stripped);
  if (v6Words) {
    return isPrivateIPv6Words(v6Words);
  }
  return true;
}

export async function assertSafeUrl(urlString: string): Promise<URL> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    throw new SsrfSecurityError(`Invalid URL string: ${urlString}`);
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new SsrfSecurityError(`Prohibited protocol '${parsedUrl.protocol}'. Only http: and https: are permitted.`);
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const strippedHost = hostname.replace(/^\[|\]$/g, '');

  if (
    strippedHost === 'localhost' ||
    strippedHost.endsWith('.localhost') ||
    strippedHost.endsWith('.local') ||
    strippedHost.endsWith('.internal') ||
    strippedHost === '0.0.0.0' ||
    strippedHost === '127.0.0.1' ||
    strippedHost === '::1'
  ) {
    throw new SsrfSecurityError(`Prohibited hostname '${hostname}'`);
  }

  const directV4 = parseIPv4ToBytes(strippedHost);
  if (directV4) {
    if (isPrivateIPv4Bytes(directV4[0], directV4[1], directV4[2], directV4[3])) {
      throw new SsrfSecurityError(`Direct private IP access forbidden: ${hostname}`);
    }
    return parsedUrl;
  }

  const directV6 = parseIPv6ToWords(strippedHost);
  if (directV6) {
    if (isPrivateIPv6Words(directV6)) {
      throw new SsrfSecurityError(`Direct private IPv6 access forbidden: ${hostname}`);
    }
    return parsedUrl;
  }

  try {
    const lookupResults = await dns.lookup(strippedHost, { all: true });
    if (!lookupResults || lookupResults.length === 0) {
      throw new SsrfSecurityError(`Could not resolve hostname '${hostname}'`);
    }

    for (const record of lookupResults) {
      if (isPrivateIp(record.address)) {
        throw new SsrfSecurityError(
          `Hostname '${hostname}' resolved to private/loopback IP '${record.address}'`
        );
      }
    }
  } catch (err: any) {
    if (err instanceof SsrfSecurityError) throw err;
    throw new SsrfSecurityError(`DNS lookup failed for '${hostname}': ${err.message}`);
  }

  return parsedUrl;
}

const ssrfAgent = new Agent({
  connect: {
    lookup: async (hostname, _options, callback) => {
      try {
        const stripped = hostname.replace(/^\[|\]$/g, '');
        if (
          stripped === 'localhost' ||
          stripped.endsWith('.localhost') ||
          stripped.endsWith('.local') ||
          stripped.endsWith('.internal')
        ) {
          callback(new SsrfSecurityError(`Prohibited hostname '${hostname}'`), []);
          return;
        }

        const directV4 = parseIPv4ToBytes(stripped);
        if (directV4 && isPrivateIPv4Bytes(directV4[0], directV4[1], directV4[2], directV4[3])) {
          callback(new SsrfSecurityError(`Direct private IP blocked: '${hostname}'`), []);
          return;
        }

        const directV6 = parseIPv6ToWords(stripped);
        if (directV6 && isPrivateIPv6Words(directV6)) {
          callback(new SsrfSecurityError(`Direct private IPv6 blocked: '${hostname}'`), []);
          return;
        }

        const records = await dns.lookup(stripped, { all: true });
        if (!records || records.length === 0) {
          callback(new SsrfSecurityError(`Cannot resolve hostname '${hostname}'`), []);
          return;
        }

        for (const r of records) {
          if (isPrivateIp(r.address)) {
            callback(new SsrfSecurityError(`DNS rebinding protection blocked private IP '${r.address}' for '${hostname}'`), []);
            return;
          }
        }

        callback(null, records);
      } catch (err: any) {
        callback(err as Error, []);
      }
    },
  },
});

export async function safeFetch(
  url: string,
  options: RequestInit = {},
  maxRedirects = 5
): Promise<Response> {
  let currentUrl = url;
  let redirectsCount = 0;

  while (true) {
    await assertSafeUrl(currentUrl);

    const mergedOptions: any = {
      ...options,
      redirect: 'manual',
      dispatcher: ssrfAgent,
    };

    const response = await fetch(currentUrl, mergedOptions);

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        return response;
      }

      redirectsCount++;
      if (redirectsCount > maxRedirects) {
        throw new SsrfSecurityError(`Too many redirects (exceeded limit of ${maxRedirects})`);
      }

      const nextUrl = new URL(location, currentUrl).toString();
      currentUrl = nextUrl;
      continue;
    }

    return response;
  }
}
