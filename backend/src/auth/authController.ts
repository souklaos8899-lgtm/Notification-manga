import { Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../config';
import {
  AuthError,
  getSystemSettings,
  login,
  quickPersonalLogin,
  register,
  updateSystemSettings,
} from './authService';

const loginSchema = z.object({
  username: z.string().min(1, 'กรุณากรอกชื่อผู้ใช้'),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
});

const registerSchema = z.object({
  username: z.string().min(3, 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร'),
  password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
  displayName: z.string().optional().default(''),
});

const settingsUpdateSchema = z.object({
  appMode: z.enum(['personal', 'public']).optional(),
  allowPublicRegistration: z.boolean().optional(),
  checkIntervalMinutes: z.number().int().min(5).max(1440).optional(),
});

function setTokenCookie(res: Response, token: string): void {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

function clearTokenCookie(res: Response): void {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    path: '/',
  });
}

export async function handleGetMe(req: Request, res: Response): Promise<void> {
  const settings = getSystemSettings();
  res.json({
    user: req.user || null,
    settings,
  });
}

export async function handleGetSettings(_req: Request, res: Response): Promise<void> {
  const settings = getSystemSettings();
  res.json(settings);
}

export async function handleLogin(req: Request, res: Response): Promise<void> {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0]?.message || 'ข้อมูลไม่ถูกต้อง' });
      return;
    }

    const { username, password } = parseResult.data;
    const { token, user } = await login(username, password);

    setTokenCookie(res, token);
    res.json({ token, user });
  } catch (err: any) {
    if (err instanceof AuthError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
  }
}

export async function handleQuickPersonalLogin(req: Request, res: Response): Promise<void> {
  try {
    const { token, user } = quickPersonalLogin();
    setTokenCookie(res, token);
    res.json({ token, user });
  } catch (err: any) {
    if (err instanceof AuthError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด่วน' });
  }
}

export async function handleRegister(req: Request, res: Response): Promise<void> {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0]?.message || 'ข้อมูลไม่ถูกต้อง' });
      return;
    }

    const { username, password, displayName } = parseResult.data;
    const { token, user } = await register(username, password, displayName);

    setTokenCookie(res, token);
    res.status(201).json({ token, user });
  } catch (err: any) {
    if (err instanceof AuthError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลงทะเบียน' });
  }
}

export async function handleLogout(req: Request, res: Response): Promise<void> {
  clearTokenCookie(res);
  res.json({ success: true, message: 'ออกจากระบบเรียบร้อยแล้ว' });
}

export async function handleUpdateSettings(req: Request, res: Response): Promise<void> {
  try {
    const parseResult = settingsUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0]?.message || 'ข้อมูลการตั้งค่าไม่ถูกต้อง' });
      return;
    }

    const updated = updateSystemSettings(parseResult.data);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'ไม่สามารถอัปเดตการตั้งค่าได้' });
  }
}
