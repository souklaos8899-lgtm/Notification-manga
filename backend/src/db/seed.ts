import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export function seedInitialData(db: DatabaseSync): void {
  // Check settings
  const settingsRow = db.prepare('SELECT id FROM system_settings WHERE id = ?').get('default');
  if (!settingsRow) {
    db.prepare(`
      INSERT INTO system_settings (id, app_mode, allow_public_registration, check_interval_minutes, last_global_check_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('default', 'personal', 0, 60, null);
  }

  // Check admin user
  const adminRow = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminRow) {
    const saltRounds = 12;
    const passwordHash = bcrypt.hashSync('admin123', saltRounds);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, username, password_hash, display_name, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, 'admin', passwordHash, 'เจ้าของระบบ (Personal)', 'admin', now);
  }
}
