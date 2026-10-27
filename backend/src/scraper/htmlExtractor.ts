import * as cheerio from 'cheerio';
import {
  DetectedChapterCandidate,
  ExtractionMode,
  UrlAnalyzeResultDto,
} from '../types/contract';

export function parseChapterNumber(text: string): number | null {
  if (!text) return null;
  const clean = text.trim();

  // Pattern with keywords: ตอนที่, ตอน, บทที่, EP, Ch., Chapter, Chap
  const keywordRegex = /(?:ตอนที่|ตอน|บทที่|ep\.?|ch(?:apter|\.)?|chap\.?)\s*([0-9]+(?:[\.\-][0-9]+)?)/i;
  const match = clean.match(keywordRegex);
  if (match && match[1]) {
    const numStr = match[1].replace('-', '.');
    const val = parseFloat(numStr);
    if (!isNaN(val)) return val;
  }

  // Match #123
  const hashMatch = clean.match(/#\s*([0-9]+(?:\.[0-9]+)?)/);
  if (hashMatch && hashMatch[1]) {
    const val = parseFloat(hashMatch[1]);
    if (!isNaN(val)) return val;
  }

  // Fallback: look for standalone decimal or integer numbers
  const numberMatches = clean.match(/\b([0-9]+(?:\.[0-9]+)?)\b/g);
  if (numberMatches && numberMatches.length > 0) {
    // Return the first valid number
    for (const numStr of numberMatches) {
      const val = parseFloat(numStr);
      if (!isNaN(val) && val >= 0) return val;
    }
  }

  return null;
}

export function cleanTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  let title = rawTitle.trim();

  // Remove trailing site names or common suffixes
  const suffixes = [
    /[-|–—]\s*อ่านมังงะ.*$/i,
    /[-|–—]\s*มังงะแปลไทย.*$/i,
    /[-|–—]\s*แปลไทย.*$/i,
    /[-|–—]\s*อ่านการ์ตูน.*$/i,
    /[-|–—]\s*ตอนล่าสุด.*$/i,
    /[-|–—]\s*Manga.*$/i,
    /[-|–—]\s*Manhwa.*$/i,
    /[-|–—]\s*Manhua.*$/i,
    /\s*อ่านมังงะ\s*$/i,
    /\s*มังงะแปลไทย\s*$/i,
    /\s*แปลไทย\s*$/i,
    /\s*ตอนล่าสุด\s*$/i,
  ];

  for (const suf of suffixes) {
    title = title.replace(suf, '').trim();
  }

  // If title has separator like "Title | SiteName", keep the first part
  if (title.includes(' | ')) {
    title = title.split(' | ')[0].trim();
  } else if (title.includes(' - ')) {
    const parts = title.split(' - ');
    if (parts.length > 1 && parts[parts.length - 1].length < 25) {
      title = parts.slice(0, parts.length - 1).join(' - ').trim();
    }
  }

  return title;
}

export function resolveUrl(relativeOrAbsolute: string | undefined | null, baseUrl: string): string | null {
  if (!relativeOrAbsolute) return null;
  const trimmed = relativeOrAbsolute.trim();
  if (!trimmed || trimmed.startsWith('javascript:') || trimmed.startsWith('#')) return null;

  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

export function extractMangaInfoFromHtml(
  html: string,
  baseUrl: string,
  extractionMode: ExtractionMode = { kind: 'auto' }
): UrlAnalyzeResultDto {
  const $ = cheerio.load(html);
  let domain = '';
  try {
    domain = new URL(baseUrl).hostname;
  } catch {
    domain = baseUrl;
  }

  // 1. Title Extraction
  let rawTitle = '';
  if (extractionMode.kind === 'css' && extractionMode.titleSelector) {
    rawTitle = $(extractionMode.titleSelector).first().text();
  }
  if (!rawTitle) {
    rawTitle =
      $('meta[property="og:title"]').attr('content') ||
      $('h1.entry-title').first().text() ||
      $('.post-title h1').first().text() ||
      $('.series-title h2').first().text() ||
      $('h1').first().text() ||
      $('title').first().text() ||
      '';
  }
  const detectedTitle = cleanTitle(rawTitle) || 'Untitled Manga';

  // 2. Cover URL Extraction
  let rawCover: string | undefined;
  if (extractionMode.kind === 'css' && extractionMode.coverSelector) {
    const el = $(extractionMode.coverSelector).first();
    rawCover = el.attr('src') || el.attr('data-src') || el.attr('data-lazy-src');
  }
  if (!rawCover) {
    rawCover =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('.summary_image img').attr('data-src') ||
      $('.summary_image img').attr('src') ||
      $('.thumb img').attr('data-src') ||
      $('.thumb img').attr('src') ||
      $('img.wp-post-image').attr('data-src') ||
      $('img.wp-post-image').attr('src') ||
      $('.series-thumb img').attr('src') ||
      $('.post-thumb img').attr('src');
  }
  const detectedCoverUrl = resolveUrl(rawCover, baseUrl);

  // 3. Platform & Chapter Extraction
  let detectedPlatform: UrlAnalyzeResultDto['detectedPlatform'] = 'generic_chapter';
  const candidates: DetectedChapterCandidate[] = [];
  const seenUrls = new Set<string>();

  // Helper to add candidate
  const addCandidate = (titleText: string, href: string | undefined, selectorHint: string, confidence: 'high' | 'medium' | 'low') => {
    const chapterUrl = resolveUrl(href, baseUrl);
    if (!chapterUrl || seenUrls.has(chapterUrl)) return;

    const cleanTitleText = titleText.replace(/\s+/g, ' ').trim();
    if (!cleanTitleText) return;

    seenUrls.add(chapterUrl);
    const chapterNumber = parseChapterNumber(cleanTitleText);

    candidates.push({
      chapterNumber,
      chapterTitle: cleanTitleText,
      chapterUrl,
      selectorHint,
      confidence,
    });
  };

  // Case 1: Custom CSS mode
  if (extractionMode.kind === 'css' && extractionMode.chapterSelector) {
    detectedPlatform = 'custom';
    $(extractionMode.chapterSelector).each((_, el) => {
      const $el = $(el);
      const href = $el.is('a') ? $el.attr('href') : $el.find('a').attr('href');
      const text = $el.text();
      addCandidate(text, href, extractionMode.chapterSelector, 'high');
    });
  } else {
    // Case 2: WordPress Madara
    const madaraElements = $('.wp-manga-chapter a, li.wp-manga-chapter a');
    if (madaraElements.length > 0) {
      detectedPlatform = 'madara';
      madaraElements.each((_, el) => {
        const $el = $(el);
        addCandidate($el.text(), $el.attr('href'), '.wp-manga-chapter a', 'high');
      });
    }

    // Case 3: MangaStream / Themesia
    if (candidates.length === 0) {
      const mangastreamElements = $(
        '#chapterlist li a, .eph-num a, .bixbox.bxcl ul li a, .chbox a, .cl ul li a'
      );
      if (mangastreamElements.length > 0) {
        detectedPlatform = 'mangastream';
        mangastreamElements.each((_, el) => {
          const $el = $(el);
          addCandidate($el.text(), $el.attr('href'), '#chapterlist li a', 'high');
        });
      }
    }

    // Case 4: Generic Chapter Pattern (Thai & International)
    if (candidates.length === 0) {
      detectedPlatform = 'generic_chapter';
      $('a').each((_, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        const href = $el.attr('href');
        if (!href) return;

        // Check if text matches chapter patterns
        const isChapterPattern =
          /(?:ตอนที่|ตอน|บทที่|ep\.?|ch(?:apter|\.)?|chap\.?)\s*[0-9]+/i.test(text) ||
          /#\s*[0-9]+/.test(text);

        if (isChapterPattern) {
          addCandidate(text, href, 'a[chapter-pattern]', 'medium');
        }
      });
    }
  }

  // Sort candidates so the newest/highest chapter is first
  candidates.sort((a, b) => {
    if (a.chapterNumber !== null && b.chapterNumber !== null) {
      return b.chapterNumber - a.chapterNumber;
    }
    if (a.chapterNumber !== null) return -1;
    if (b.chapterNumber !== null) return 1;
    return 0;
  });

  const top12Candidates = candidates.slice(0, 12);
  const recommendedChapter = top12Candidates.length > 0 ? top12Candidates[0] : null;

  return {
    url: baseUrl,
    domain,
    detectedTitle,
    detectedCoverUrl,
    detectedPlatform,
    recommendedChapter,
    candidates: top12Candidates,
  };
}
