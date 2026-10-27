import { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { UserProfileDto } from '../types/contract';
import { verifyToken } from './authService';

declare global {
  namespace Express {
    interface Request {
      user?: UserProfileDto | null;
    }
  }
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.cookies && req.cookies[config.cookieName]) {
    return req.cookies[config.cookieName];
  }
  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' });
    return;
  }

  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: 'เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' });
    return;
  }

  req.user = user;
  next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    req.user = verifyToken(token);
  } else {
    req.user = null;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง ต้องเป็นผู้ดูแลระบบ (Admin) เท่านั้น' });
      return;
    }
    next();
  });
}
