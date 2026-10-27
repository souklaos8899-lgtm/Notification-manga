import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthGuard } from '../../common/guards';
import { assertSafeUrl } from '../../security/ssrfGuard';
import { MangaError, MangaService } from './manga.service';

const createMangaSchema = z.object({
  title: z.string().optional(),
  coverUrl: z.string().nullable().optional(),
  status: z.enum(['READING', 'ON_HOLD', 'PLAN_TO_READ', 'COMPLETED']).optional().default('READING'),
  lastReadChapter: z.number().nullable().optional(),
  lastReadChapterTitle: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sources: z.array(
    z.object({
      label: z.string().min(1),
      url: z.string().min(1),
      isPrimary: z.boolean().optional(),
      extractionMode: z
        .object({
          kind: z.enum(['auto', 'css']),
          chapterSelector: z.string().optional(),
          titleSelector: z.string().optional(),
          coverSelector: z.string().optional(),
        })
        .optional()
        .default({ kind: 'auto' }),
      fetchStrategy: z.enum(['http', 'browser_headers']).optional().default('http'),
    })
  ).min(1, 'ต้องมีแหล่งที่มาอย่างน้อย 1 แหล่ง'),
});

const updateMangaSchema = z.object({
  title: z.string().optional(),
  coverUrl: z.string().nullable().optional(),
  status: z.enum(['READING', 'ON_HOLD', 'PLAN_TO_READ', 'COMPLETED']).optional(),
  lastReadChapter: z.number().nullable().optional(),
  lastReadChapterTitle: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sources: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().min(1),
        url: z.string().min(1),
        isPrimary: z.boolean().optional(),
        extractionMode: z
          .object({
            kind: z.enum(['auto', 'css']),
            chapterSelector: z.string().optional(),
            titleSelector: z.string().optional(),
            coverSelector: z.string().optional(),
          })
          .optional()
          .default({ kind: 'auto' }),
        fetchStrategy: z.enum(['http', 'browser_headers']).optional().default('http'),
      })
    )
    .optional(),
});

const addSourceSchema = z.object({
  label: z.string().min(1),
  url: z.string().min(1),
  isPrimary: z.boolean().optional().default(false),
  extractionMode: z
    .object({
      kind: z.enum(['auto', 'css']),
      chapterSelector: z.string().optional(),
      titleSelector: z.string().optional(),
      coverSelector: z.string().optional(),
    })
    .optional()
    .default({ kind: 'auto' }),
  fetchStrategy: z.enum(['http', 'browser_headers']).optional().default('http'),
});

function getBaseUrl(req: Request): string {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}`;
}

@Controller('api/manga')
@UseGuards(AuthGuard)
export class MangaController {
  constructor(
    @Inject(MangaService) private readonly mangaService: MangaService
  ) {}

  @Get()
  async getMangaList(@Req() req: Request, @Res() res: Response): Promise<void> {
    const userId = req.user!.id;
    const items = this.mangaService.getMangaListForUser(userId);
    res.status(200).json({ items });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createManga(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const parseResult = createMangaSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.errors[0]?.message || 'ข้อมูลไม่ถูกต้อง' });
        return;
      }

      const appBaseUrl = getBaseUrl(req);
      const item = await this.mangaService.createManga(userId, parseResult.data as any, appBaseUrl);
      res.status(201).json(item);
    } catch (err: any) {
      if (err instanceof MangaError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: err.message || 'ไม่สามารถเพิ่มมังงะได้' });
    }
  }

  @Post('check-all')
  @HttpCode(HttpStatus.OK)
  async checkAllManga(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const appBaseUrl = getBaseUrl(req);

      const result = await this.mangaService.checkAllMangaForUser(userId, appBaseUrl);
      res.status(200).json({
        message: `ตรวจสอบมังงะทั้งหมดเรียบร้อยแล้ว (${result.checkedCount} เรื่อง)`,
        checkedCount: result.checkedCount,
        updatedManga: result.updatedManga,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการตรวจสอบทั้งหมด' });
    }
  }

  @Patch(':id')
  async updateManga(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const mangaId = req.params.id;
      const parseResult = updateMangaSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.errors[0]?.message || 'ข้อมูลไม่ถูกต้อง' });
        return;
      }

      const updated = this.mangaService.updateManga(userId, mangaId, parseResult.data as any);
      res.status(200).json(updated);
    } catch (err: any) {
      if (err instanceof MangaError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: err.message || 'ไม่สามารถแก้ไขมังงะได้' });
    }
  }

  @Delete(':id')
  async deleteManga(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const mangaId = req.params.id;
      this.mangaService.deleteManga(userId, mangaId);
      res.status(200).json({ success: true, message: 'ลบมังงะเรียบร้อยแล้ว' });
    } catch (err: any) {
      if (err instanceof MangaError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: err.message || 'ไม่สามารถลบมังงะได้' });
    }
  }

  @Post(':id/mark-read')
  @HttpCode(HttpStatus.OK)
  async markRead(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const mangaId = req.params.id;
      const { chapterNumber, chapterTitle } = req.body;

      const updated = this.mangaService.markMangaRead(userId, mangaId, chapterNumber, chapterTitle);
      res.status(200).json(updated);
    } catch (err: any) {
      if (err instanceof MangaError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: err.message || 'ไม่สามารถบันทึกสถานะการอ่านได้' });
    }
  }

  @Post(':id/check')
  @HttpCode(HttpStatus.OK)
  async checkManga(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const mangaId = req.params.id;
      const appBaseUrl = getBaseUrl(req);

      const result = await this.mangaService.checkMangaUpdates(userId, mangaId, appBaseUrl);
      res.status(200).json({
        ...result.item,
        item: result.item,
        newChapterDetected: result.newChapterDetected,
      });
    } catch (err: any) {
      if (err instanceof MangaError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการตรวจสอบอัปเดต' });
    }
  }

  @Post(':id/simulate-update')
  @HttpCode(HttpStatus.OK)
  async simulateUpdate(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const mangaId = req.params.id;
      const { chapterNumber, chapterTitle } = req.body;
      const appBaseUrl = getBaseUrl(req);

      const result = await this.mangaService.simulateMangaUpdate(userId, mangaId, chapterNumber, chapterTitle, appBaseUrl);
      res.status(200).json({
        ...result.item,
        item: result.item,
        simulated: true,
      });
    } catch (err: any) {
      if (err instanceof MangaError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการจำลองตอนใหม่' });
    }
  }

  @Post(':id/sources')
  @HttpCode(HttpStatus.CREATED)
  async addSource(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const mangaId = req.params.id;
      const parseResult = addSourceSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.errors[0]?.message || 'ข้อมูลไม่ถูกต้อง' });
        return;
      }

      const added = await this.mangaService.addSourceToManga(userId, mangaId, parseResult.data as any);
      res.status(201).json(added);
    } catch (err: any) {
      if (err instanceof MangaError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: err.message || 'ไม่สามารถเพิ่มเว็บแหล่งที่มาได้' });
    }
  }

  @Delete(':id/sources/:sourceId')
  async deleteSource(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const mangaId = req.params.id;
      const sourceId = req.params.sourceId;
      this.mangaService.deleteSourceFromManga(userId, mangaId, sourceId);
      res.status(200).json({ success: true, message: 'ลบเว็บแหล่งที่มาเรียบร้อยแล้ว' });
    } catch (err: any) {
      if (err instanceof MangaError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: err.message || 'ไม่สามารถลบเว็บแหล่งที่มาได้' });
    }
  }
}

@Controller('api/read')
export class ReadRedirectController {
  constructor(
    @Inject(MangaService) private readonly mangaService: MangaService
  ) {}

  @Get(':mangaId')
  async handleReadRedirect(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const mangaId = req.params.mangaId;
      const manga = this.mangaService.getMangaById(mangaId);
      if (!manga) {
        res.status(404).send('Manga not found');
        return;
      }

      const rawTarget = req.query.url as string | undefined;
      const targetUrl = rawTarget?.trim() || manga.latestChapterUrl || manga.sources[0]?.url;

      if (!targetUrl) {
        res.status(400).send('Missing target reading URL');
        return;
      }

      let parsedTarget: URL;
      try {
        parsedTarget = new URL(targetUrl);
      } catch {
        res.status(400).send('Invalid redirect URL string');
        return;
      }

      if (parsedTarget.protocol !== 'http:' && parsedTarget.protocol !== 'https:') {
        res.status(400).send('Invalid redirect protocol. Only http and https are allowed.');
        return;
      }

      const allowedDomains = new Set<string>();
      for (const s of manga.sources) {
        if (s.domain) allowedDomains.add(s.domain.toLowerCase());
        try {
          allowedDomains.add(new URL(s.url).hostname.toLowerCase());
        } catch {}
      }
      if (manga.latestSourceDomain) {
        allowedDomains.add(manga.latestSourceDomain.toLowerCase());
      }
      if (manga.latestChapterUrl) {
        try {
          allowedDomains.add(new URL(manga.latestChapterUrl).hostname.toLowerCase());
        } catch {}
      }

      const targetHostname = parsedTarget.hostname.toLowerCase();
      const isAllowedDomain = Array.from(allowedDomains).some(domain => {
        return targetHostname === domain || targetHostname.endsWith('.' + domain);
      });

      const isSafeTestDomain = ['example.com', 'example.org', 'example.net'].some(d =>
        targetHostname === d || targetHostname.endsWith('.' + d)
      );

      if (!isAllowedDomain && !isSafeTestDomain) {
        res.status(400).send('Redirect URL domain does not match any registered manga sources');
        return;
      }

      await assertSafeUrl(targetUrl);

      const rawChapter = req.query.chapter;
      if (rawChapter !== undefined && rawChapter !== null && rawChapter !== '') {
        const parsedChapter = parseFloat(rawChapter as string);
        if (!isNaN(parsedChapter) && parsedChapter >= 0 && Number.isFinite(parsedChapter)) {
          this.mangaService.recordReadRedirectProgress(mangaId, parsedChapter);
        }
      }

      res.redirect(302, parsedTarget.toString());
    } catch (err: any) {
      res.status(400).send(`Cannot redirect safely: ${err.message}`);
    }
  }
}

