import { Module } from '@nestjs/common';
import { MangaSchedulerService } from './scheduler.service';

@Module({
  providers: [MangaSchedulerService],
  exports: [MangaSchedulerService],
})
export class SchedulerModule {}

