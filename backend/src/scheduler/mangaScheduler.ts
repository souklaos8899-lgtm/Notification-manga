import cron from 'node-cron';
import { getSystemSettings, updateSystemSettings } from '../auth/authService';
import { getDatabase } from '../db/database';
import { checkMangaUpdates } from '../manga/mangaService';

let scheduledTask: cron.ScheduledTask | null = null;
let isCheckRunning = false;

export async function runGlobalMangaCheck(): Promise<void> {
  if (isCheckRunning) return;
  isCheckRunning = true;

  try {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT id, user_id FROM manga WHERE status = 'READING'
    `).all() as any[];

    const now = new Date().toISOString();
    updateSystemSettings({ lastGlobalCheckAt: now });

    for (const row of rows) {
      try {
        await checkMangaUpdates(row.user_id, row.id);
      } catch {
        // Continue even if one fails
      }
    }
  } catch (err) {
    console.error('Error in global manga update check:', err);
  } finally {
    isCheckRunning = false;
  }
}

export function startMangaScheduler(): void {
  const settings = getSystemSettings();
  const intervalMinutes = Math.max(5, settings.checkIntervalMinutes || 60);

  // Stop previous if exists
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }

  // Cron pattern for every N minutes
  // E.g. */15 * * * * or run every N minutes
  const cronExpr = intervalMinutes < 60
    ? `*/${intervalMinutes} * * * *`
    : `0 */${Math.floor(intervalMinutes / 60)} * * *`;

  scheduledTask = cron.schedule(cronExpr, () => {
    runGlobalMangaCheck();
  });
}

export function stopMangaScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
