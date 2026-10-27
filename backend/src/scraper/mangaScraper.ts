import { safeFetch } from '../security/ssrfGuard';
import {
  ExtractionMode,
  FetchStrategy,
  UrlAnalyzeResultDto,
} from '../types/contract';
import { extractMangaInfoFromHtml } from './htmlExtractor';
import { generateDemoHtml, isDemoUrl, parseDemoUrl } from './mockDemoServer';

export class ScraperError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'ScraperError';
  }
}

export function getBrowserHeaders(strategy: FetchStrategy = 'http', targetUrl?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };

  if (strategy === 'browser_headers' && targetUrl) {
    try {
      const origin = new URL(targetUrl).origin;
      headers['Referer'] = `${origin}/`;
    } catch {
      // ignore
    }
  }

  return headers;
}

export async function scrapeMangaUrl(
  url: string,
  options: {
    extractionMode?: ExtractionMode;
    fetchStrategy?: FetchStrategy;
  } = {}
): Promise<UrlAnalyzeResultDto> {
  const { extractionMode = { kind: 'auto' }, fetchStrategy = 'http' } = options;

  if (!url || typeof url !== 'string') {
    throw new ScraperError('กรุณาระบุ URL ที่ต้องการวิเคราะห์', 400);
  }

  const cleanUrl = url.trim();

  // If virtual demo URL or internal mock
  if (isDemoUrl(cleanUrl)) {
    const demoInfo = parseDemoUrl(cleanUrl);
    const html = generateDemoHtml(demoInfo.title, demoInfo.chapter, demoInfo.coverUrl || undefined);
    return extractMangaInfoFromHtml(html, cleanUrl, extractionMode);
  }

  // Real external URL: fetch with SSRF guard
  try {
    const headers = getBrowserHeaders(fetchStrategy, cleanUrl);
    const response = await safeFetch(cleanUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new ScraperError(
        `ไม่สามารถเข้าถึงเว็บไซต์ได้ (HTTP ${response.status} ${response.statusText})`,
        response.status >= 500 ? 502 : 400
      );
    }

    const html = await response.text();
    return extractMangaInfoFromHtml(html, cleanUrl, extractionMode);
  } catch (err: any) {
    if (err instanceof ScraperError) throw err;
    throw new ScraperError(`เกิดข้อผิดพลาดในการดึงข้อมูลจากเว็บ: ${err.message}`, 400);
  }
}
