import { Request, Response } from 'express';

export function generateDemoHtml(
  title: string = 'Solo Leveling (Demo Manga)',
  chapterNumber: number = 105,
  coverUrl: string = 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400'
): string {
  const chapters = [];
  const startCh = Math.max(1, chapterNumber - 5);
  for (let ch = chapterNumber; ch >= startCh; ch--) {
    chapters.push(`
      <li class="wp-manga-chapter">
        <a href="https://demo-manga.internal/read/${encodeURIComponent(title)}/ch-${ch}">
          ตอนที่ ${ch} - การต่อสู้ครั้งใหม่
        </a>
        <span class="chapter-release-date">เมื่อสักครู่</span>
      </li>
    `);
  }

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>${title} แปลไทย ตอนล่าสุด - อ่านมังงะออนไลน์</title>
  <meta property="og:title" content="${title}">
  <meta property="og:image" content="${coverUrl}">
</head>
<body>
  <div class="site-content">
    <div class="post-title">
      <h1>${title}</h1>
    </div>
    <div class="summary_image">
      <img src="${coverUrl}" alt="${title}" class="wp-post-image" />
    </div>
    <div class="listing-chapters_wrap">
      <ul class="main version-chap">
        ${chapters.join('\n')}
      </ul>
    </div>
  </div>
</body>
</html>`;
}

export function isDemoUrl(url: string): boolean {
  return url.startsWith('demo://') || url.includes('/api/demo-manga-page');
}

export function parseDemoUrl(url: string): { title: string; chapter: number; coverUrl: string | null } {
  try {
    if (url.startsWith('demo://')) {
      // demo://manga/solo-leveling?chapter=105&title=Solo+Leveling
      const dummyHttp = url.replace('demo://', 'http://demo.local/');
      const parsed = new URL(dummyHttp);
      const queryCh = parsed.searchParams.get('chapter');
      const queryTitle = parsed.searchParams.get('title');
      const chapter = queryCh ? parseFloat(queryCh) : 100;
      const slug = parsed.pathname.replace(/^\/manga\/?/, '') || 'Demo Manga';
      const title = queryTitle || slug.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const coverUrl = parsed.searchParams.get('cover') || 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400';
      return { title, chapter: isNaN(chapter) ? 100 : chapter, coverUrl };
    }

    const parsed = new URL(url);
    const queryCh = parsed.searchParams.get('chapter');
    const queryTitle = parsed.searchParams.get('title');
    const chapter = queryCh ? parseFloat(queryCh) : 100;
    const title = queryTitle || 'Solo Leveling (Demo)';
    const coverUrl = parsed.searchParams.get('cover') || 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400';
    return { title, chapter: isNaN(chapter) ? 100 : chapter, coverUrl };
  } catch {
    return {
      title: 'Demo Manga',
      chapter: 100,
      coverUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400',
    };
  }
}

export function handleDemoMangaPage(req: Request, res: Response): void {
  const title = (req.query.title as string) || 'Solo Leveling (Demo Manga)';
  const chapter = parseFloat((req.query.chapter as string) || '105');
  const coverUrl = (req.query.cover as string) || 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400';

  const html = generateDemoHtml(title, isNaN(chapter) ? 105 : chapter, coverUrl);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

