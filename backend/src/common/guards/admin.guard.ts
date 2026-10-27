import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { verifyToken } from '../../modules/auth/auth.service';
import { extractToken } from './auth.guard';

@Injectable()
export class AdminGuard implements CanActivate {
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

    if (user.role !== 'admin') {
      throw new HttpException({ error: 'ไม่มีสิทธิ์เข้าถึง ต้องเป็นผู้ดูแลระบบ (Admin) เท่านั้น' }, HttpStatus.FORBIDDEN);
    }

    req.user = user;
    return true;
  }
}

