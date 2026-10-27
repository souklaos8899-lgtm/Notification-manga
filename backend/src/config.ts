import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'manga-secret-key-32-chars-long-secure-random-2026',
  jwtExpiresIn: '7d',
  cookieName: 'manga_token',
  dbPath: process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'manga.db'),
  defaultCheckIntervalMinutes: parseInt(process.env.CHECK_INTERVAL_MINUTES || '60', 10),
};
