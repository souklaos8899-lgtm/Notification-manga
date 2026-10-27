import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthGuard } from '../../common/guards';
import { ScraperError } from './mangaScraper';
import { handleDemoMangaPage } from './mockDemoServer';
import { ScraperService } from './scraper.service';

const analyzeUrlSchema = z.object({
  url: z.string().min(1, 'กรุณาระบุ URL'),
  fetchStrategy: z.enum(['http', 'browser_headers']).optional().default('http'),
});

@Controller()
export class ScraperController {
  constructor(
    @Inject(ScraperService) private readonly scraperService: ScraperService
  ) {}

  @Post('api/scraper/analyze')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  async analyzeUrl(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const parseResult = analyzeUrlSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.errors[0]?.message || 'URL ไม่ถูกต้อง' });
        return;
      }

      const { url, fetchStrategy } = parseResult.data;
      const result = await this.scraperService.analyzeUrl(url, fetchStrategy);
      res.status(200).json(result);
    } catch (err: any) {
      if (err instanceof ScraperError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการวิเคราะห์ URL' });
    }
  }

  @Get('api/demo-manga-page')
  async getDemoPage(@Req() req: Request, @Res() res: Response): Promise<void> {
    handleDemoMangaPage(req, res);
  }
}

