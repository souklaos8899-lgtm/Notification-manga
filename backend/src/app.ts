import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express, NextFunction, Request, Response } from 'express';
import {
  handleGetMe,
  handleGetSettings,
  handleLogin,
  handleLogout,
  handleQuickPersonalLogin,
  handleRegister,
  handleUpdateSettings,
} from './auth/authController';
import { optionalAuth, requireAdmin, requireAuth } from './auth/authMiddleware';
import {
  handleCreateChannel,
  handleDeleteChannel,
  handleGetChannels,
  handleGetNotifications,
  handleMarkAllNotificationsRead,
  handleMarkNotificationRead,
  handleTestChannel,
  handleUpdateChannel,
} from './channels/channelController';
import {
  handleAddSource,
  handleAnalyzeUrl,
  handleCheckAllManga,
  handleCheckManga,
  handleCreateManga,
  handleDeleteManga,
  handleDeleteSource,
  handleGetMangaList,
  handleMarkRead,
  handleReadRedirect,
  handleSimulateUpdate,
  handleUpdateManga,
} from './manga/mangaController';
import { handleDemoMangaPage } from './scraper/mockDemoServer';

const authRateLimits = new Map<string, { count: number; resetAt: number }>();

function authRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 50;

  const record = authRateLimits.get(ip);
  if (!record || now > record.resetAt) {
    authRateLimits.set(ip, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }

  if (record.count >= maxRequests) {
    res.setHeader('Retry-After', Math.ceil((record.resetAt - now) / 1000));
    res.status(429).json({ error: 'มีคำขอเข้าสู่ระบบมากเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง' });
    return;
  }

  record.count++;
  next();
}

export function createApp(): Express {
  const app = express();

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/demo-manga-page', handleDemoMangaPage);
  app.get('/api/read/:mangaId', handleReadRedirect);

  app.get('/api/auth/me', optionalAuth, handleGetMe);
  app.post('/api/auth/login', authRateLimiter, handleLogin);
  app.post('/api/auth/quick-personal-login', authRateLimiter, handleQuickPersonalLogin);
  app.post('/api/auth/register', authRateLimiter, handleRegister);
  app.post('/api/auth/logout', handleLogout);

  app.post('/api/scraper/analyze', requireAuth, handleAnalyzeUrl);

  app.get('/api/manga', requireAuth, handleGetMangaList);
  app.post('/api/manga', requireAuth, handleCreateManga);
  app.patch('/api/manga/:id', requireAuth, handleUpdateManga);
  app.delete('/api/manga/:id', requireAuth, handleDeleteManga);
  app.post('/api/manga/:id/mark-read', requireAuth, handleMarkRead);
  app.post('/api/manga/:id/check', requireAuth, handleCheckManga);
  app.post('/api/manga/check-all', requireAuth, handleCheckAllManga);
  app.post('/api/manga/:id/simulate-update', requireAuth, handleSimulateUpdate);
  app.post('/api/manga/:id/sources', requireAuth, handleAddSource);
  app.delete('/api/manga/:id/sources/:sourceId', requireAuth, handleDeleteSource);

  app.get('/api/channels', requireAuth, handleGetChannels);
  app.post('/api/channels', requireAuth, handleCreateChannel);
  app.patch('/api/channels/:id', requireAuth, handleUpdateChannel);
  app.delete('/api/channels/:id', requireAuth, handleDeleteChannel);
  app.post('/api/channels/:id/test', requireAuth, handleTestChannel);

  app.get('/api/notifications', requireAuth, handleGetNotifications);
  app.patch('/api/notifications/:id/read', requireAuth, handleMarkNotificationRead);
  app.post('/api/notifications/:id/read', requireAuth, handleMarkNotificationRead);
  app.post('/api/notifications/read-all', requireAuth, handleMarkAllNotificationsRead);
  app.post('/api/notifications/mark-all-read', requireAuth, handleMarkAllNotificationsRead);

  app.get('/api/settings', optionalAuth, handleGetSettings);
  app.patch('/api/settings', requireAdmin, handleUpdateSettings);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  return app;
}
