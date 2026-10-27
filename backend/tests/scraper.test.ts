import { describe, expect, it } from 'vitest';
import {
  cleanTitle,
  extractMangaInfoFromHtml,
  parseChapterNumber,
} from '../src/modules/scraper/htmlExtractor';
import { generateDemoHtml, parseDemoUrl } from '../src/modules/scraper/mockDemoServer';

describe('Scraper & HTML Extractor Tests', () => {
  it('correctly parses chapter numbers from various formats', () => {
    // Thai formats
    expect(parseChapterNumber('ตอนที่ 145.5 ตอนพิเศษ')).toBe(145.5);
    expect(parseChapterNumber('ตอน 10')).toBe(10);
    expect(parseChapterNumber('บทที่ 24.1 การเริ่มต้น')).toBe(24.1);
    expect(parseChapterNumber('Solo Leveling ตอนที่ 179 จบ')).toBe(179);
    expect(parseChapterNumber('ตอนที่ 12-1')).toBe(12.1);

    // International formats
    expect(parseChapterNumber('Chapter 105.2 - Special')).toBe(105.2);
    expect(parseChapterNumber('Ch. 88')).toBe(88);
    expect(parseChapterNumber('Ch.88.5')).toBe(88.5);
    expect(parseChapterNumber('Chap 99')).toBe(99);
    expect(parseChapterNumber('Ep 25')).toBe(25);
    expect(parseChapterNumber('EP. 30')).toBe(30);
    expect(parseChapterNumber('#42 New Beginning')).toBe(42);
  });

  it('cleans title correctly by stripping suffixes', () => {
    expect(cleanTitle('Solo Leveling แปลไทย - อ่านมังงะออนไลน์')).toBe('Solo Leveling');
    expect(cleanTitle('One Piece | อ่านมังงะ')).toBe('One Piece');
    expect(cleanTitle('Jujutsu Kaisen ตอนล่าสุด')).toBe('Jujutsu Kaisen');
  });

  it('extracts WordPress Madara chapter list and details', () => {
    const madaraHtml = `
      <html>
        <head>
          <title>Tower of God - อ่านมังงะ</title>
          <meta property="og:title" content="Tower of God" />
          <meta property="og:image" content="https://example.com/tog.jpg" />
        </head>
        <body>
          <h1 class="entry-title">Tower of God</h1>
          <ul class="version-chap">
            <li class="wp-manga-chapter">
              <a href="https://example.com/manga/tog/ch-550/">ตอนที่ 550 การต่อสู้บนยอดหอคอย</a>
            </li>
            <li class="wp-manga-chapter">
              <a href="https://example.com/manga/tog/ch-549/">ตอนที่ 549 ทางเลือกสุดท้าย</a>
            </li>
          </ul>
        </body>
      </html>
    `;

    const result = extractMangaInfoFromHtml(madaraHtml, 'https://example.com/manga/tog');
    expect(result.detectedTitle).toBe('Tower of God');
    expect(result.detectedCoverUrl).toBe('https://example.com/tog.jpg');
    expect(result.detectedPlatform).toBe('madara');
    expect(result.recommendedChapter).not.toBeNull();
    expect(result.recommendedChapter?.chapterNumber).toBe(550);
    expect(result.recommendedChapter?.chapterUrl).toBe('https://example.com/manga/tog/ch-550/');
    expect(result.candidates.length).toBe(2);
  });

  it('extracts MangaStream / Themesia chapter list and details', () => {
    const mangastreamHtml = `
      <html>
        <head>
          <title>Chainsaw Man มังงะแปลไทย</title>
        </head>
        <body>
          <div class="post-title">
            <h1>Chainsaw Man</h1>
          </div>
          <div class="thumb">
            <img src="/images/csm.png" />
          </div>
          <div id="chapterlist">
            <ul>
              <li data-num="160">
                <div class="eph-num">
                  <a href="/csm/chapter-160">
                    <span class="chapternum">Chapter 160</span>
                  </a>
                </div>
              </li>
              <li data-num="159">
                <div class="eph-num">
                  <a href="/csm/chapter-159">
                    <span class="chapternum">Chapter 159</span>
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </body>
      </html>
    `;

    const result = extractMangaInfoFromHtml(mangastreamHtml, 'https://mangastream-demo.com/csm');
    expect(result.detectedTitle).toBe('Chainsaw Man');
    expect(result.detectedCoverUrl).toBe('https://mangastream-demo.com/images/csm.png');
    expect(result.detectedPlatform).toBe('mangastream');
    expect(result.recommendedChapter?.chapterNumber).toBe(160);
    expect(result.recommendedChapter?.chapterUrl).toBe('https://mangastream-demo.com/csm/chapter-160');
  });

  it('extracts custom CSS selector when configured', () => {
    const customHtml = `
      <html>
        <body>
          <h2 class="my-custom-title">Custom Comic</h2>
          <img class="my-cover" src="https://custom.com/cover.jpg" />
          <div class="chapter-box">
            <div class="single-row"><a href="https://custom.com/c12">ตอนที่ 12</a></div>
            <div class="single-row"><a href="https://custom.com/c11">ตอนที่ 11</a></div>
          </div>
        </body>
      </html>
    `;

    const result = extractMangaInfoFromHtml(customHtml, 'https://custom.com', {
      kind: 'css',
      titleSelector: '.my-custom-title',
      coverSelector: '.my-cover',
      chapterSelector: '.chapter-box a',
    });

    expect(result.detectedTitle).toBe('Custom Comic');
    expect(result.detectedCoverUrl).toBe('https://custom.com/cover.jpg');
    expect(result.detectedPlatform).toBe('custom');
    expect(result.recommendedChapter?.chapterNumber).toBe(12);
  });

  it('handles virtual demo manga URLs and generates valid chapter HTML', () => {
    const parsed = parseDemoUrl('demo://manga/solo-leveling?chapter=105&title=Solo+Leveling');
    expect(parsed.title).toBe('Solo Leveling');
    expect(parsed.chapter).toBe(105);

    const demoHtml = generateDemoHtml(parsed.title, parsed.chapter);
    expect(demoHtml).toContain('ตอนที่ 105');
    expect(demoHtml).toContain('Solo Leveling');

    const result = extractMangaInfoFromHtml(demoHtml, 'demo://manga/solo-leveling?chapter=105');
    expect(result.recommendedChapter?.chapterNumber).toBe(105);
  });
});
