import { Injectable } from '@nestjs/common';
import { FetchStrategy, UrlAnalyzeResultDto } from '../../types/contract';
import { scrapeMangaUrl } from './mangaScraper';

@Injectable()
export class ScraperService {
  async scrapeMangaUrl(
    url: string,
    options?: Parameters<typeof scrapeMangaUrl>[1]
  ): Promise<UrlAnalyzeResultDto> {
    return scrapeMangaUrl(url, options);
  }

  async analyzeUrl(url: string, fetchStrategy?: FetchStrategy): Promise<UrlAnalyzeResultDto> {
    return scrapeMangaUrl(url, { fetchStrategy });
  }
}

