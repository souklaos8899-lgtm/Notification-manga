import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { runGlobalMangaCheck, startMangaScheduler, stopMangaScheduler } from './mangaScheduler';

@Injectable()
export class MangaSchedulerService implements OnModuleDestroy {
  start(): void {
    startMangaScheduler();
  }

  stop(): void {
    stopMangaScheduler();
  }

  async runGlobalCheck(): Promise<void> {
    return runGlobalMangaCheck();
  }

  onModuleDestroy(): void {
    this.stop();
  }
}

