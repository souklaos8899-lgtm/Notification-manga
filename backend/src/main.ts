import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { config } from './config';
import { getDatabase } from './db/database';
import { createSchema } from './db/schema';
import { seedInitialData } from './db/seed';
import { MangaSchedulerService } from './modules/scheduler/scheduler.service';

async function bootstrap(): Promise<void> {
  console.log('🚀 Starting Notification Manga Backend (NestJS)...');

  // Initialize DB & Seed
  const db = getDatabase();
  createSchema(db);
  seedInitialData(db);
  console.log('📦 Database initialized and seeded.');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use((_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
  });

  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Start background scheduler
  const scheduler = app.get(MangaSchedulerService);
  scheduler.start();
  console.log(`⏰ Manga update scheduler running (interval: ${config.defaultCheckIntervalMinutes}m).`);

  await app.listen(config.port);
  console.log(`✨ Server listening on http://localhost:${config.port}`);
  console.log(`📚 Ready to track and notify manga updates!`);
}

bootstrap().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

