import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { verifyToken } from '../../modules/auth/auth.service';
import { extractToken } from './auth.guard';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const token = extractToken(req);
    if (token) {
      req.user = verifyToken(token);
    } else {
      req.user = null;
    }
    return true;
  }
}

