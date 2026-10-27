import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { HealthController } from './modules/health/health.controller';
import { MangaModule } from './modules/manga/manga.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { ScraperModule } from './modules/scraper/scraper.module';

@Module({
  imports: [
    AuthModule,
    ScraperModule,
    MangaModule,
    ChannelsModule,
    NotificationsModule,
    SchedulerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

