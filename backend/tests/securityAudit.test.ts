import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { initDatabase } from '../src/db/database';
import { createSchema } from '../src/db/schema';
import { seedInitialData } from '../src/db/seed';

describe('Security Audit & Defense Verification Tests', () => {
  let app: any;
  let adminToken: string;
  let userBToken: string;
  let adminMangaId: string;

  beforeAll(async () => {
    const db = initDatabase(':memory:');
    createSchema(db);
    seedInitialData(db);
    app = createApp();

    const adminLoginRes = await request(app)
      .post('/api/auth/quick-personal-login')
      .expect(200);
    adminToken = adminLoginRes.body.token;

    await request(app)
      .patch('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ allowPublicRegistration: true })
      .expect(200);

    const userBRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'victim_user',
        password: 'password123',
        displayName: 'Victim User',
      })
      .expect(201);
    userBToken = userBRes.body.token;

    const mangaRes = await request(app)
      .post('/api/manga')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Security Audited Manga',
        status: 'READING',
        sources: [
          {
            label: 'Legitimate Source',
            url: 'https://example.com/series/123',
            isPrimary: true,
          },
        ],
      })
      .expect(201);
    adminMangaId = mangaRes.body.id;
  });

  describe('Security Headers', () => {
    it('sets protective security headers on HTTP responses', async () => {
      const res = await request(app).get('/health').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('Open Redirect & State Mutation Hardening on /api/read/:mangaId', () => {
    it('rejects javascript: and data: pseudo-protocols', async () => {
      const jsRes = await request(app)
        .get(`/api/read/${adminMangaId}?url=${encodeURIComponent('javascript:alert(document.cookie)')}`);
      expect(jsRes.status).toBe(400);

      const dataRes = await request(app)
        .get(`/api/read/${adminMangaId}?url=${encodeURIComponent('data:text/html,<script>alert(1)</script>')}`);
      expect(dataRes.status).toBe(400);
    });

    it('rejects redirect to arbitrary external phishing domain not registered on manga', async () => {
      const phishingUrl = 'https://evil-phishing-login.com/steal-creds';
      const res = await request(app)
        .get(`/api/read/${adminMangaId}?url=${encodeURIComponent(phishingUrl)}`);
      expect(res.status).toBe(400);
      expect(res.text).toContain('does not match any registered manga sources');
    });

    it('allows redirect to registered source domain', async () => {
      const legitimateUrl = 'https://example.com/series/123/chapter-1';
      const res = await request(app)
        .get(`/api/read/${adminMangaId}?chapter=1&url=${encodeURIComponent(legitimateUrl)}`)
        .expect(302);
      expect(res.header.location).toBe(legitimateUrl);
    });

    it('returns 404 if manga does not exist', async () => {
      const res = await request(app)
        .get('/api/read/00000000-0000-0000-0000-000000000000?url=https://example.com');
      expect(res.status).toBe(404);
    });
  });

  describe('Secret Tokens Masking in Channels', () => {
    it('masks Telegram botToken, LINE accessToken, and Discord webhook secrets in responses', async () => {
      const createTg = await request(app)
        .post('/api/channels')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Private Telegram',
          enabled: true,
          config: {
            kind: 'telegram',
            botToken: '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ',
            chatId: '987654321',
          },
        })
        .expect(201);

      expect(createTg.body.config.botToken).toContain('••••');
      expect(createTg.body.config.botToken).not.toBe('123456789:ABCdefGHIjklMNOpqrSTUvwxYZ');

      const createLine = await request(app)
        .post('/api/channels')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Private LINE',
          enabled: true,
          config: {
            kind: 'line',
            channelAccessToken: 'secret_line_access_token_super_long_value_12345',
            toUserId: 'U123456789',
          },
        })
        .expect(201);

      expect(createLine.body.config.channelAccessToken).toContain('••••');

      const listRes = await request(app)
        .get('/api/channels')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      for (const ch of listRes.body.items) {
        if (ch.config.kind === 'telegram') {
          expect(ch.config.botToken).toContain('••••');
        }
        if (ch.config.kind === 'line') {
          expect(ch.config.channelAccessToken).toContain('••••');
        }
      }
    });
  });

  describe('Anti-IDOR on Manga Sources and Notification Read Endpoints', () => {
    let createdSourceId: string;

    it('allows owner to add source to manga', async () => {
      const res = await request(app)
        .post(`/api/manga/${adminMangaId}/sources`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          label: 'Backup Source',
          url: 'demo://manga/backup?chapter=10',
          isPrimary: false,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      createdSourceId = res.body.id;
    });

    it('prevents non-owner User B from adding source to Admin manga (Anti-IDOR)', async () => {
      const res = await request(app)
        .post(`/api/manga/${adminMangaId}/sources`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          label: 'Hacker Source',
          url: 'https://hacker.com/manga',
          isPrimary: false,
        });

      expect(res.status).toBe(404);
    });

    it('prevents non-owner User B from deleting source from Admin manga (Anti-IDOR)', async () => {
      const res = await request(app)
        .delete(`/api/manga/${adminMangaId}/sources/${createdSourceId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
    });

    it('allows owner to delete non-primary source', async () => {
      await request(app)
        .delete(`/api/manga/${adminMangaId}/sources/${createdSourceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('prevents non-owner User B from marking Admin notification as read (Anti-IDOR)', async () => {
      await request(app)
        .post(`/api/manga/${adminMangaId}/simulate-update`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ chapterNumber: 2 })
        .expect(200);

      const notifsRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const notifId = notifsRes.body.items[0].id;

      const attackerRes = await request(app)
        .patch(`/api/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(attackerRes.status).toBe(404);

      await request(app)
        .patch(`/api/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
