import { Module } from '@nestjs/common';
import { MangaController, ReadRedirectController } from './manga.controller';
import { MangaService } from './manga.service';

@Module({
  controllers: [MangaController, ReadRedirectController],
  providers: [MangaService],
  exports: [MangaService],
})
export class MangaModule {}

