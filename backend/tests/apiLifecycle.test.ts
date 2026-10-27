import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { initDatabase } from '../src/db/database';
import { createSchema } from '../src/db/schema';
import { seedInitialData } from '../src/db/seed';

describe('Full API Lifecycle & Multi-User Isolation Tests', () => {
  let app: any;
  let adminToken: string;
  let adminUserId: string;
  let userBToken: string;
  let userBId: string;
  let createdMangaId: string;

  beforeAll(async () => {
    // Initialize in-memory SQLite database
    const db = initDatabase(':memory:');
    createSchema(db);
    seedInitialData(db);
    app = await createApp();
  });

  it('checks health endpoint', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('serves demo manga page for offline testing', async () => {
    const res = await request(app)
      .get('/api/demo-manga-page?title=Tower+of+God&chapter=120')
      .expect(200);
    expect(res.text).toContain('Tower of God');
    expect(res.text).toContain('ตอนที่ 120');
  });

  describe('Authentication & Personal Mode', () => {
    it('returns null user and default settings for unauthenticated /api/auth/me', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.user).toBeNull();
      expect(res.body.settings.appMode).toBe('personal');
    });

    it('allows 1-click personal quick login', async () => {
      const res = await request(app)
        .post('/api/auth/quick-personal-login')
        .expect(200);

      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe('admin');
      expect(res.body.user.role).toBe('admin');
      adminToken = res.body.token;
      adminUserId = res.body.user.id;
    });

    it('rejects invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrongpassword' });
      expect(res.status).toBe(401);
    });

    it('allows regular login with admin123', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' })
        .expect(200);

      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe('admin');
    });
  });

  describe('Settings & Registration', () => {
    it('allows admin to enable public registration', async () => {
      const res = await request(app)
        .patch('/api/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ allowPublicRegistration: true })
        .expect(200);

      expect(res.body.allowPublicRegistration).toBe(true);
    });

    it('allows user B to register when public registration is enabled', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user_b',
          password: 'password123',
          displayName: 'Reader B',
        })
        .expect(201);

      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe('user_b');
      userBToken = res.body.token;
      userBId = res.body.user.id;
    });
  });

  describe('Manga Management & Multi-User Anti-IDOR', () => {
    it('creates a tracked manga for Admin using demo URL', async () => {
      const res = await request(app)
        .post('/api/manga')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Solo Leveling',
          status: 'READING',
          sources: [
            {
              label: 'Primary Demo Web',
              url: 'demo://manga/solo-leveling?chapter=105',
              isPrimary: true,
            },
          ],
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Solo Leveling');
      expect(res.body.latestChapter).toBe(105);
      expect(res.body.hasUnread).toBe(true);
      expect(res.body.sources.length).toBe(1);
      createdMangaId = res.body.id;
    });

    it('enforces multi-user isolation: User B cannot see Admin manga in list', async () => {
      const res = await request(app)
        .get('/api/manga')
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(0);
    });

    it('enforces Anti-IDOR: User B cannot modify or delete Admin manga', async () => {
      // User B tries to update Admin manga
      const patchRes = await request(app)
        .patch(`/api/manga/${createdMangaId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ title: 'Hacked Title' });
      expect(patchRes.status).toBe(404);

      // User B tries to delete Admin manga
      const deleteRes = await request(app)
        .delete(`/api/manga/${createdMangaId}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(deleteRes.status).toBe(404);
    });

    it('allows Admin to mark manga as read', async () => {
      const res = await request(app)
        .post(`/api/manga/${createdMangaId}/mark-read`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ chapterNumber: 105, chapterTitle: 'ตอนที่ 105' })
        .expect(200);

      expect(res.body.lastReadChapter).toBe(105);
      expect(res.body.hasUnread).toBe(false);
      expect(res.body.unreadCountEstimate).toBe(0);
    });

    it('simulates new chapter update and emits in-app notification', async () => {
      const res = await request(app)
        .post(`/api/manga/${createdMangaId}/simulate-update`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ chapterNumber: 106, chapterTitle: 'ตอนที่ 106 การต่อสู้ครั้งใหม่' })
        .expect(200);

      expect(res.body.item.latestChapter).toBe(106);
      expect(res.body.item.hasUnread).toBe(true);
      expect(res.body.item.unreadCountEstimate).toBe(1);

      // Check notification logs
      const notifRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(notifRes.body.items.length).toBeGreaterThanOrEqual(1);
      const latestNotif = notifRes.body.items[0];
      expect(latestNotif.mangaTitle).toBe('Solo Leveling');
      expect(latestNotif.chapterNumber).toBe(106);
      expect(latestNotif.isRead).toBe(false);
    });

    it('marks all in-app notifications as read', async () => {
      const res = await request(app)
        .post('/api/notifications/read-all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      const notifRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(notifRes.body.items.every((n: any) => n.isRead)).toBe(true);
    });

    it('1-click read redirect records progress and redirects to reading page', async () => {
      const redirectUrl = `https://example.com/read/solo-leveling/ch-106`;
      const res = await request(app)
        .get(`/api/read/${createdMangaId}?chapter=106&url=${encodeURIComponent(redirectUrl)}`)
        .expect(302);

      expect(res.header.location).toBe(redirectUrl);

      // Verify progress was recorded
      const mangaRes = await request(app)
        .get('/api/manga')
        .set('Authorization', `Bearer ${adminToken}`);
      const item = mangaRes.body.items.find((m: any) => m.id === createdMangaId);
      expect(item.lastReadChapter).toBe(106);
      expect(item.hasUnread).toBe(false);
    });
  });

  describe('Channel Management', () => {
    let channelId: string;

    it('creates a notification channel', async () => {
      const res = await request(app)
        .post('/api/channels')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'My Discord Server',
          enabled: true,
          config: {
            kind: 'discord',
            webhookUrl: 'https://discord.com/api/webhooks/123/abc',
          },
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('My Discord Server');
      channelId = res.body.id;
    });

    it('lists notification channels for user', async () => {
      const res = await request(app)
        .get('/api/channels')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(channelId);
    });

    it('updates notification channel', async () => {
      const res = await request(app)
        .patch(`/api/channels/${channelId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'My Updated Discord',
          enabled: false,
        })
        .expect(200);

      expect(res.body.name).toBe('My Updated Discord');
      expect(res.body.enabled).toBe(false);
    });

    it('deletes notification channel', async () => {
      await request(app)
        .delete(`/api/channels/${channelId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const res = await request(app)
        .get('/api/channels')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.body.items).toHaveLength(0);
    });
  });
});
