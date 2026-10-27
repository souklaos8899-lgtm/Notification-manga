import crypto from 'node:crypto';
import { getDatabase } from '../db/database';
import { dispatchMangaUpdateNotification } from '../notifications/notifier';
import { scrapeMangaUrl } from '../scraper/mangaScraper';
import {
  ExtractionMode,
  FetchStrategy,
  MangaItemDto,
  MangaSourceDto,
  ReadingStatus,
  SourceCheckState,
} from '../types/contract';

export class MangaError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'MangaError';
  }
}

export function formatMangaRow(row: any, sources: MangaSourceDto[]): MangaItemDto {
  const lastRead = row.last_read_chapter !== null ? Number(row.last_read_chapter) : null;
  const latest = row.latest_chapter !== null ? Number(row.latest_chapter) : null;

  let hasUnread = false;
  let unreadCountEstimate = 0;

  if (latest !== null) {
    if (lastRead === null) {
      hasUnread = true;
      unreadCountEstimate = 1;
    } else if (latest > lastRead) {
      hasUnread = true;
      unreadCountEstimate = Math.max(1, Math.round(latest - lastRead));
    }
  }

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    coverUrl: row.cover_url || null,
    status: row.status as ReadingStatus,
    lastReadChapter: lastRead,
    lastReadChapterTitle: row.last_read_chapter_title || null,
    lastReadAt: row.last_read_at || null,
    latestChapter: latest,
    latestChapterTitle: row.latest_chapter_title || null,
    latestChapterUrl: row.latest_chapter_url || null,
    latestSourceDomain: row.latest_source_domain || null,
    latestUpdatedAt: row.latest_updated_at || null,
    hasUnread,
    unreadCountEstimate,
    notes: row.notes || null,
    sources,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getSourcesForManga(mangaId: string): MangaSourceDto[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM manga_sources WHERE manga_id = ? ORDER BY is_primary DESC, created_at ASC').all(mangaId) as any[];

  return rows.map(r => {
    let extractionMode: ExtractionMode = { kind: 'auto' };
    let checkState: SourceCheckState = { kind: 'idle' };

    try {
      extractionMode = JSON.parse(r.extraction_mode);
    } catch {}

    try {
      checkState = JSON.parse(r.check_state);
    } catch {}

    return {
      id: r.id,
      mangaId: r.manga_id,
      label: r.label,
      url: r.url,
      domain: r.domain,
      isPrimary: Boolean(r.is_primary),
      extractionMode,
      fetchStrategy: r.fetch_strategy as FetchStrategy,
      checkState,
    };
  });
}

export function getMangaListForUser(userId: string): MangaItemDto[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM manga WHERE user_id = ? ORDER BY updated_at DESC').all(userId) as any[];

  return rows.map(row => {
    const sources = getSourcesForManga(row.id);
    return formatMangaRow(row, sources);
  });
}

export function getMangaById(mangaId: string, userId?: string): MangaItemDto | null {
  const db = getDatabase();
  let query = 'SELECT * FROM manga WHERE id = ?';
  const params: any[] = [mangaId];

  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  const row = db.prepare(query).get(...params) as any;
  if (!row) return null;

  const sources = getSourcesForManga(row.id);
  return formatMangaRow(row, sources);
}

export interface CreateMangaInput {
  title?: string;
  coverUrl?: string | null;
  status?: ReadingStatus;
  lastReadChapter?: number | null;
  lastReadChapterTitle?: string | null;
  notes?: string | null;
  sources: Array<{
    label: string;
    url: string;
    isPrimary?: boolean;
    extractionMode?: ExtractionMode;
    fetchStrategy?: FetchStrategy;
  }>;
}

export async function createManga(userId: string, input: CreateMangaInput, appBaseUrl?: string): Promise<MangaItemDto> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const mangaId = crypto.randomUUID();

  if (!input.sources || input.sources.length === 0) {
    throw new MangaError('ต้องระบุแหล่งที่มา (Source URL) อย่างน้อย 1 แหล่ง', 400);
  }

  // Pick primary source
  const primarySourceIndex = input.sources.findIndex(s => s.isPrimary);
  const primaryIdx = primarySourceIndex >= 0 ? primarySourceIndex : 0;
  const primaryInput = input.sources[primaryIdx];

  let detectedTitle = input.title;
  let detectedCoverUrl = input.coverUrl;
  let latestChapter: number | null = null;
  let latestChapterTitle: string | null = null;
  let latestChapterUrl: string | null = null;
  let latestDomain: string | null = null;
  let primaryCheckState: SourceCheckState = { kind: 'idle' };

  // Run initial scrape on primary source to extract info
  try {
    const scraped = await scrapeMangaUrl(primaryInput.url, {
      extractionMode: primaryInput.extractionMode,
      fetchStrategy: primaryInput.fetchStrategy,
    });

    if (!detectedTitle) detectedTitle = scraped.detectedTitle;
    if (!detectedCoverUrl && scraped.detectedCoverUrl) detectedCoverUrl = scraped.detectedCoverUrl;
    latestDomain = scraped.domain;

    if (scraped.recommendedChapter) {
      latestChapter = scraped.recommendedChapter.chapterNumber;
      latestChapterTitle = scraped.recommendedChapter.chapterTitle;
      latestChapterUrl = scraped.recommendedChapter.chapterUrl;
      primaryCheckState = {
        kind: 'ok',
        chapterNumber: latestChapter,
        chapterTitle: latestChapterTitle,
        chapterUrl: latestChapterUrl,
        checkedAt: now,
      };
    }
  } catch (err: any) {
    primaryCheckState = {
      kind: 'error',
      error: err.message,
      checkedAt: now,
    };
  }

  const finalTitle = detectedTitle?.trim() || 'Untitled Manga';

  db.prepare(`
    INSERT INTO manga (
      id, user_id, title, cover_url, status,
      last_read_chapter, last_read_chapter_title, last_read_at,
      latest_chapter, latest_chapter_title, latest_chapter_url, latest_source_domain, latest_updated_at,
      notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    mangaId,
    userId,
    finalTitle,
    detectedCoverUrl || null,
    input.status || 'READING',
    input.lastReadChapter ?? null,
    input.lastReadChapterTitle ?? null,
    input.lastReadChapter !== undefined && input.lastReadChapter !== null ? now : null,
    latestChapter,
    latestChapterTitle,
    latestChapterUrl,
    latestDomain,
    latestChapter !== null ? now : null,
    input.notes || null,
    now,
    now
  );

  // Insert sources
  for (let i = 0; i < input.sources.length; i++) {
    const s = input.sources[i];
    const sourceId = crypto.randomUUID();
    let domain = '';
    try {
      domain = new URL(s.url).hostname;
    } catch {
      domain = s.url;
    }

    const isPrimary = i === primaryIdx;
    const checkState = isPrimary ? primaryCheckState : { kind: 'idle' };

    db.prepare(`
      INSERT INTO manga_sources (
        id, manga_id, label, url, domain, is_primary, extraction_mode, fetch_strategy, check_state, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sourceId,
      mangaId,
      s.label || domain,
      s.url,
      domain,
      isPrimary ? 1 : 0,
      JSON.stringify(s.extractionMode || { kind: 'auto' }),
      s.fetchStrategy || 'http',
      JSON.stringify(checkState),
      now
    );
  }

  return getMangaById(mangaId, userId)!;
}

export interface UpdateMangaInput {
  title?: string;
  coverUrl?: string | null;
  status?: ReadingStatus;
  lastReadChapter?: number | null;
  lastReadChapterTitle?: string | null;
  notes?: string | null;
  sources?: Array<{
    id?: string;
    label: string;
    url: string;
    isPrimary?: boolean;
    extractionMode?: ExtractionMode;
    fetchStrategy?: FetchStrategy;
  }>;
}

export function updateManga(userId: string, mangaId: string, input: UpdateMangaInput): MangaItemDto {
  const db = getDatabase();
  const existing = getMangaById(mangaId, userId);
  if (!existing) {
    throw new MangaError('ไม่พบข้อมูลมังงะที่ระบุ', 404);
  }

  const now = new Date().toISOString();
  const nextTitle = input.title !== undefined ? input.title.trim() : existing.title;
  const nextCover = input.coverUrl !== undefined ? input.coverUrl : existing.coverUrl;
  const nextStatus = input.status !== undefined ? input.status : existing.status;
  const nextLastReadCh = input.lastReadChapter !== undefined ? input.lastReadChapter : existing.lastReadChapter;
  const nextLastReadTitle = input.lastReadChapterTitle !== undefined ? input.lastReadChapterTitle : existing.lastReadChapterTitle;
  const nextLastReadAt = input.lastReadChapter !== undefined ? now : existing.lastReadAt;
  const nextNotes = input.notes !== undefined ? input.notes : existing.notes;

  db.prepare(`
    UPDATE manga
    SET title = ?, cover_url = ?, status = ?,
        last_read_chapter = ?, last_read_chapter_title = ?, last_read_at = ?,
        notes = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(
    nextTitle,
    nextCover,
    nextStatus,
    nextLastReadCh,
    nextLastReadTitle,
    nextLastReadAt,
    nextNotes,
    now,
    mangaId,
    userId
  );

  // Update sources if provided
  if (input.sources) {
    db.prepare('DELETE FROM manga_sources WHERE manga_id = ?').run(mangaId);
    for (let i = 0; i < input.sources.length; i++) {
      const s = input.sources[i];
      const sourceId = s.id || crypto.randomUUID();
      let domain = '';
      try {
        domain = new URL(s.url).hostname;
      } catch {
        domain = s.url;
      }
      const isPrimary = s.isPrimary ?? (i === 0);

      db.prepare(`
        INSERT INTO manga_sources (
          id, manga_id, label, url, domain, is_primary, extraction_mode, fetch_strategy, check_state, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sourceId,
        mangaId,
        s.label || domain,
        s.url,
        domain,
        isPrimary ? 1 : 0,
        JSON.stringify(s.extractionMode || { kind: 'auto' }),
        s.fetchStrategy || 'http',
        JSON.stringify({ kind: 'idle' }),
        now
      );
    }
  }

  return getMangaById(mangaId, userId)!;
}

export function deleteManga(userId: string, mangaId: string): void {
  const db = getDatabase();
  const existing = getMangaById(mangaId, userId);
  if (!existing) {
    throw new MangaError('ไม่พบข้อมูลมังงะที่ต้องการลบ', 404);
  }

  db.prepare('DELETE FROM manga WHERE id = ? AND user_id = ?').run(mangaId, userId);
}

export function markMangaRead(
  userId: string,
  mangaId: string,
  chapterNumber?: number | null,
  chapterTitle?: string | null
): MangaItemDto {
  const db = getDatabase();
  const existing = getMangaById(mangaId, userId);
  if (!existing) {
    throw new MangaError('ไม่พบข้อมูลมังงะที่ระบุ', 404);
  }

  const targetCh = chapterNumber !== undefined && chapterNumber !== null ? chapterNumber : existing.latestChapter;
  const targetTitle = chapterTitle !== undefined && chapterTitle !== null ? chapterTitle : existing.latestChapterTitle;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE manga
    SET last_read_chapter = ?, last_read_chapter_title = ?, last_read_at = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(targetCh, targetTitle, now, now, mangaId, userId);

  return getMangaById(mangaId, userId)!;
}

export async function checkMangaUpdates(
  userId: string,
  mangaId: string,
  appBaseUrl?: string
): Promise<{ item: MangaItemDto; newChapterDetected: boolean }> {
  const db = getDatabase();
  const existing = getMangaById(mangaId, userId);
  if (!existing) {
    throw new MangaError('ไม่พบข้อมูลมังงะที่ระบุ', 404);
  }

  const now = new Date().toISOString();
  let highestChapter: number | null = null;
  let highestChapterTitle: string = '';
  let highestChapterUrl: string = '';
  let highestDomain: string = '';

  for (const source of existing.sources) {
    try {
      const scraped = await scrapeMangaUrl(source.url, {
        extractionMode: source.extractionMode,
        fetchStrategy: source.fetchStrategy,
      });

      const rec = scraped.recommendedChapter;
      const checkState: SourceCheckState = rec
        ? {
            kind: 'ok',
            chapterNumber: rec.chapterNumber,
            chapterTitle: rec.chapterTitle,
            chapterUrl: rec.chapterUrl,
            checkedAt: now,
          }
        : {
            kind: 'error',
            error: 'ไม่พบตอนในหน้าเว็บ',
            checkedAt: now,
          };

      db.prepare(`
        UPDATE manga_sources
        SET check_state = ?
        WHERE id = ?
      `).run(JSON.stringify(checkState), source.id);

      if (rec && rec.chapterNumber !== null) {
        if (highestChapter === null || rec.chapterNumber > highestChapter) {
          highestChapter = rec.chapterNumber;
          highestChapterTitle = rec.chapterTitle;
          highestChapterUrl = rec.chapterUrl;
          highestDomain = scraped.domain;
        }
      }
    } catch (err: any) {
      const errorCheckState: SourceCheckState = {
        kind: 'error',
        error: err.message,
        checkedAt: now,
      };
      db.prepare(`
        UPDATE manga_sources
        SET check_state = ?
        WHERE id = ?
      `).run(JSON.stringify(errorCheckState), source.id);
    }
  }

  let newChapterDetected = false;
  if (highestChapter !== null) {
    const isNewer = existing.latestChapter === null || highestChapter > existing.latestChapter;
    if (isNewer) {
      newChapterDetected = true;

      db.prepare(`
        UPDATE manga
        SET latest_chapter = ?, latest_chapter_title = ?, latest_chapter_url = ?,
            latest_source_domain = ?, latest_updated_at = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).run(
        highestChapter,
        highestChapterTitle,
        highestChapterUrl,
        highestDomain,
        now,
        now,
        mangaId,
        userId
      );

      // Dispatch notifications
      await dispatchMangaUpdateNotification({
        userId,
        mangaId,
        mangaTitle: existing.title,
        chapterNumber: highestChapter,
        chapterTitle: highestChapterTitle,
        chapterUrl: highestChapterUrl,
        lastReadChapter: existing.lastReadChapter,
        domain: highestDomain,
        coverUrl: existing.coverUrl,
        appBaseUrl,
      });
    }
  }

  const updatedItem = getMangaById(mangaId, userId)!;
  return {
    item: updatedItem,
    newChapterDetected,
  };
}

export async function checkAllMangaForUser(
  userId: string,
  appBaseUrl?: string
): Promise<{ checkedCount: number; updatedManga: MangaItemDto[] }> {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT id FROM manga WHERE user_id = ? AND status = 'READING'
  `).all(userId) as any[];

  const updatedManga: MangaItemDto[] = [];

  for (const row of rows) {
    try {
      const res = await checkMangaUpdates(userId, row.id, appBaseUrl);
      if (res.newChapterDetected) {
        updatedManga.push(res.item);
      }
    } catch {
      // Continue to next manga even if one fails
    }
  }

  return {
    checkedCount: rows.length,
    updatedManga,
  };
}

export async function simulateMangaUpdate(
  userId: string,
  mangaId: string,
  targetChapter?: number | null,
  chapterTitle?: string | null,
  appBaseUrl?: string
): Promise<{ item: MangaItemDto; simulated: true }> {
  const db = getDatabase();
  const existing = getMangaById(mangaId, userId);
  if (!existing) {
    throw new MangaError('ไม่พบข้อมูลมังงะที่ระบุ', 404);
  }

  const currentCh = existing.latestChapter || existing.lastReadChapter || 100;
  const newChapter = targetChapter !== undefined && targetChapter !== null ? targetChapter : currentCh + 1;
  const newTitle = chapterTitle || `ตอนที่ ${newChapter} (การทดสอบจำลอง)`;
  const now = new Date().toISOString();
  const primarySource = existing.sources.find(s => s.isPrimary) || existing.sources[0];
  const domain = primarySource?.domain || 'demo-manga.internal';
  const chapterUrl = primarySource?.url || `https://${domain}/read/${newChapter}`;

  db.prepare(`
    UPDATE manga
    SET latest_chapter = ?, latest_chapter_title = ?, latest_chapter_url = ?,
        latest_source_domain = ?, latest_updated_at = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(
    newChapter,
    newTitle,
    chapterUrl,
    domain,
    now,
    now,
    mangaId,
    userId
  );

  // Dispatch real notifications
  await dispatchMangaUpdateNotification({
    userId,
    mangaId,
    mangaTitle: existing.title,
    chapterNumber: newChapter,
    chapterTitle: newTitle,
    chapterUrl,
    lastReadChapter: existing.lastReadChapter,
    domain,
    coverUrl: existing.coverUrl,
    appBaseUrl,
  });

  const updatedItem = getMangaById(mangaId, userId)!;
  return {
    item: updatedItem,
    simulated: true,
  };
}

export function recordReadRedirectProgress(
  mangaId: string,
  chapter?: number | null
): void {
  const db = getDatabase();
  const mangaRow = db.prepare('SELECT id, last_read_chapter FROM manga WHERE id = ?').get(mangaId) as any;
  if (!mangaRow) return;

  const currentLastRead = mangaRow.last_read_chapter !== null ? Number(mangaRow.last_read_chapter) : 0;
  const newLastRead = chapter !== undefined && chapter !== null ? Math.max(currentLastRead, chapter) : currentLastRead;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE manga
    SET last_read_chapter = ?, last_read_at = ?, updated_at = ?
    WHERE id = ?
  `).run(newLastRead, now, now, mangaId);
}

export async function addSourceToManga(
  userId: string,
  mangaId: string,
  sourceInput: {
    label: string;
    url: string;
    isPrimary?: boolean;
    extractionMode?: ExtractionMode;
    fetchStrategy?: FetchStrategy;
  }
): Promise<MangaSourceDto> {
  const db = getDatabase();
  const existing = getMangaById(mangaId, userId);
  if (!existing) {
    throw new MangaError('ไม่พบข้อมูลมังงะที่ระบุ', 404);
  }

  let domain = '';
  try {
    domain = new URL(sourceInput.url).hostname;
  } catch {
    domain = sourceInput.url;
  }

  const sourceId = crypto.randomUUID();
  const now = new Date().toISOString();
  let checkState: SourceCheckState = { kind: 'idle' };

  try {
    const scraped = await scrapeMangaUrl(sourceInput.url, {
      extractionMode: sourceInput.extractionMode,
      fetchStrategy: sourceInput.fetchStrategy,
    });
    if (scraped.recommendedChapter) {
      checkState = {
        kind: 'ok',
        chapterNumber: scraped.recommendedChapter.chapterNumber,
        chapterTitle: scraped.recommendedChapter.chapterTitle,
        chapterUrl: scraped.recommendedChapter.chapterUrl,
        checkedAt: now,
      };
    }
  } catch (err: any) {
    checkState = {
      kind: 'error',
      error: err.message,
      checkedAt: now,
    };
  }

  db.prepare(`
    INSERT INTO manga_sources (
      id, manga_id, label, url, domain, is_primary, extraction_mode, fetch_strategy, check_state, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sourceId,
    mangaId,
    sourceInput.label || domain,
    sourceInput.url,
    domain,
    sourceInput.isPrimary ? 1 : 0,
    JSON.stringify(sourceInput.extractionMode || { kind: 'auto' }),
    sourceInput.fetchStrategy || 'http',
    JSON.stringify(checkState),
    now
  );

  return {
    id: sourceId,
    mangaId,
    label: sourceInput.label || domain,
    url: sourceInput.url,
    domain,
    isPrimary: Boolean(sourceInput.isPrimary),
    extractionMode: sourceInput.extractionMode || { kind: 'auto' },
    fetchStrategy: sourceInput.fetchStrategy || 'http',
    checkState,
  };
}

export function deleteSourceFromManga(userId: string, mangaId: string, sourceId: string): void {
  const db = getDatabase();
  const existing = getMangaById(mangaId, userId);
  if (!existing) {
    throw new MangaError('ไม่พบข้อมูลมังงะที่ระบุ', 404);
  }

  const sourceRow = db.prepare('SELECT id, is_primary FROM manga_sources WHERE id = ? AND manga_id = ?').get(sourceId, mangaId) as any;
  if (!sourceRow) {
    throw new MangaError('ไม่พบแหล่งที่มาที่ต้องการลบ', 404);
  }
  if (sourceRow.is_primary) {
    throw new MangaError('ไม่สามารถลบเว็บหลัก (Primary Source) ได้', 400);
  }

  db.prepare('DELETE FROM manga_sources WHERE id = ? AND manga_id = ?').run(sourceId, mangaId);
}
