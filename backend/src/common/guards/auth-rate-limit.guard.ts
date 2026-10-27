import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';

const authRateLimits = new Map<string, { count: number; resetAt: number }>();

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxRequests = 50;

    const record = authRateLimits.get(ip);
    if (!record || now > record.resetAt) {
      authRateLimits.set(ip, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (record.count >= maxRequests) {
      res.setHeader('Retry-After', Math.ceil((record.resetAt - now) / 1000));
      throw new HttpException(
        { error: 'มีคำขอเข้าสู่ระบบมากเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง' },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    record.count++;
    return true;
  }
}

