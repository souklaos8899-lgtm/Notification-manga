import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { getDatabase } from '../../db/database';
import { SystemSettingsDto, UserProfileDto } from '../../types/contract';

export class AuthError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'AuthError';
  }
}

export function getSystemSettings(): SystemSettingsDto {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM system_settings WHERE id = ?').get('default') as any;
  if (!row) {
    return {
      appMode: 'personal',
      allowPublicRegistration: false,
      checkIntervalMinutes: 60,
      lastGlobalCheckAt: null,
    };
  }
  return {
    appMode: row.app_mode as 'personal' | 'public',
    allowPublicRegistration: Boolean(row.allow_public_registration),
    checkIntervalMinutes: Number(row.check_interval_minutes),
    lastGlobalCheckAt: row.last_global_check_at,
  };
}

export function updateSystemSettings(updates: Partial<{
  appMode: 'personal' | 'public';
  allowPublicRegistration: boolean;
  checkIntervalMinutes: number;
  lastGlobalCheckAt: string | null;
}>): SystemSettingsDto {
  const db = getDatabase();
  const current = getSystemSettings();
  const nextAppMode = updates.appMode ?? current.appMode;
  const nextAllowReg = updates.allowPublicRegistration !== undefined
    ? (updates.allowPublicRegistration ? 1 : 0)
    : (current.allowPublicRegistration ? 1 : 0);
  const nextInterval = updates.checkIntervalMinutes ?? current.checkIntervalMinutes;
  const nextLastCheck = updates.lastGlobalCheckAt !== undefined ? updates.lastGlobalCheckAt : current.lastGlobalCheckAt;

  db.prepare(`
    UPDATE system_settings
    SET app_mode = ?, allow_public_registration = ?, check_interval_minutes = ?, last_global_check_at = ?
    WHERE id = 'default'
  `).run(nextAppMode, nextAllowReg, nextInterval, nextLastCheck);

  return getSystemSettings();
}

export function generateToken(user: UserProfileDto): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): UserProfileDto | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    if (!decoded || !decoded.id) return null;
    return {
      id: decoded.id,
      username: decoded.username,
      displayName: decoded.displayName,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

export function getUserById(id: string): UserProfileDto | null {
  const db = getDatabase();
  const row = db.prepare('SELECT id, username, display_name, role FROM users WHERE id = ?').get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role as 'admin' | 'user',
  };
}

export async function login(username: string, password: string): Promise<{ token: string; user: UserProfileDto }> {
  const db = getDatabase();
  const row = db.prepare('SELECT id, username, password_hash, display_name, role FROM users WHERE username = ?').get(username) as any;
  if (!row) {
    throw new AuthError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);
  }

  const isMatch = await bcrypt.compare(password, row.password_hash);
  if (!isMatch) {
    throw new AuthError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);
  }

  const user: UserProfileDto = {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role as 'admin' | 'user',
  };

  const token = generateToken(user);
  return { token, user };
}

export function quickPersonalLogin(): { token: string; user: UserProfileDto } {
  const settings = getSystemSettings();
  if (settings.appMode !== 'personal') {
    throw new AuthError('โหมดส่วนตัว (Personal Mode) ไม่ได้เปิดใช้งาน', 403);
  }

  const db = getDatabase();
  const adminRow = db.prepare('SELECT id, username, display_name, role FROM users WHERE role = ? LIMIT 1').get('admin') as any;
  if (!adminRow) {
    throw new AuthError('ไม่พบบัญชีผู้ดูแลหลักสำหรับโหมดส่วนตัว', 404);
  }

  const user: UserProfileDto = {
    id: adminRow.id,
    username: adminRow.username,
    displayName: adminRow.display_name,
    role: adminRow.role as 'admin' | 'user',
  };

  const token = generateToken(user);
  return { token, user };
}

export async function register(
  username: string,
  password: string,
  displayName: string
): Promise<{ token: string; user: UserProfileDto }> {
  const settings = getSystemSettings();
  if (settings.appMode !== 'public' && !settings.allowPublicRegistration) {
    throw new AuthError('ระบบไม่อนุญาตให้ลงทะเบียนผู้ใช้ใหม่ในขณะนี้', 403);
  }

  if (!username || username.trim().length < 3) {
    throw new AuthError('ชื่อผู้ใช้ต้องมีความยาวอย่างน้อย 3 ตัวอักษร', 400);
  }
  if (!password || password.length < 6) {
    throw new AuthError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร', 400);
  }

  const cleanUsername = username.trim().toLowerCase();
  const cleanDisplayName = displayName?.trim() || cleanUsername;

  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
  if (existing) {
    throw new AuthError('ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว', 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, username, password_hash, display_name, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, cleanUsername, passwordHash, cleanDisplayName, 'user', now);

  const user: UserProfileDto = {
    id: userId,
    username: cleanUsername,
    displayName: cleanDisplayName,
    role: 'user',
  };

  const token = generateToken(user);
  return { token, user };
}

@Injectable()
export class AuthService {
  getSystemSettings(): SystemSettingsDto {
    return getSystemSettings();
  }

  updateSystemSettings(updates: Parameters<typeof updateSystemSettings>[0]): SystemSettingsDto {
    return updateSystemSettings(updates);
  }

  generateToken(user: UserProfileDto): string {
    return generateToken(user);
  }

  verifyToken(token: string): UserProfileDto | null {
    return verifyToken(token);
  }

  getUserById(id: string): UserProfileDto | null {
    return getUserById(id);
  }

  login(username: string, password: string): Promise<{ token: string; user: UserProfileDto }> {
    return login(username, password);
  }

  quickPersonalLogin(): { token: string; user: UserProfileDto } {
    return quickPersonalLogin();
  }

  register(username: string, password: string, displayName: string): Promise<{ token: string; user: UserProfileDto }> {
    return register(username, password, displayName);
  }
}

