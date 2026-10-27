import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { config } from '../../config';
import { verifyToken } from '../../modules/auth/auth.service';

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

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const token = extractToken(req);
    if (!token) {
      throw new HttpException({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, HttpStatus.UNAUTHORIZED);
    }

    const user = verifyToken(token);
    if (!user) {
      throw new HttpException({ error: 'เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' }, HttpStatus.UNAUTHORIZED);
    }

    req.user = user;
    return true;
  }
}

