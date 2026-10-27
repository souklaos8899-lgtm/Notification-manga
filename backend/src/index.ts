import { createApp } from './app';
import { config } from './config';
import { getDatabase } from './db/database';
import { createSchema } from './db/schema';
import { seedInitialData } from './db/seed';
import { startMangaScheduler } from './scheduler/mangaScheduler';

async function bootstrap(): Promise<void> {
  console.log('🚀 Starting Notification Manga Backend...');

  // Initialize DB & Seed
  const db = getDatabase();
  createSchema(db);
  seedInitialData(db);
  console.log('📦 Database initialized and seeded.');

  // Start background scheduler
  startMangaScheduler();
  console.log(`⏰ Manga update scheduler running (interval: ${config.defaultCheckIntervalMinutes}m).`);

  // Start Express server
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`✨ Server listening on http://localhost:${config.port}`);
    console.log(`📚 Ready to track and notify manga updates!`);
  });
}

bootstrap().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
