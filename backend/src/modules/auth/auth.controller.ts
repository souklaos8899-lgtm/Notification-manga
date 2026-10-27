import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { z } from 'zod';
import { AdminGuard, AuthRateLimitGuard, OptionalAuthGuard } from '../../common/guards';
import { config } from '../../config';
import { AuthError, AuthService } from './auth.service';

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

@Controller('api/auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService
  ) {}

  @Get('me')
  @UseGuards(OptionalAuthGuard)
  async getMe(@Req() req: Request, @Res() res: Response): Promise<void> {
    const settings = this.authService.getSystemSettings();
    res.status(200).json({
      user: req.user || null,
      settings,
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  async login(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.errors[0]?.message || 'ข้อมูลไม่ถูกต้อง' });
        return;
      }

      const { username, password } = parseResult.data;
      const { token, user } = await this.authService.login(username, password);

      setTokenCookie(res, token);
      res.status(200).json({ token, user });
    } catch (err: any) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
    }
  }

  @Post('quick-personal-login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  async quickPersonalLogin(@Req() _req: Request, @Res() res: Response): Promise<void> {
    try {
      const { token, user } = this.authService.quickPersonalLogin();
      setTokenCookie(res, token);
      res.status(200).json({ token, user });
    } catch (err: any) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด่วน' });
    }
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthRateLimitGuard)
  async register(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const parseResult = registerSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.errors[0]?.message || 'ข้อมูลไม่ถูกต้อง' });
        return;
      }

      const { username, password, displayName } = parseResult.data;
      const { token, user } = await this.authService.register(username, password, displayName);

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

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() _req: Request, @Res() res: Response): Promise<void> {
    clearTokenCookie(res);
    res.status(200).json({ success: true, message: 'ออกจากระบบเรียบร้อยแล้ว' });
  }
}

@Controller('api/settings')
export class SettingsController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService
  ) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  async getSettings(@Req() _req: Request, @Res() res: Response): Promise<void> {
    const settings = this.authService.getSystemSettings();
    res.status(200).json(settings);
  }

  @Patch()
  @UseGuards(AdminGuard)
  async updateSettings(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const parseResult = settingsUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.errors[0]?.message || 'ข้อมูลการตั้งค่าไม่ถูกต้อง' });
        return;
      }

      const updated = this.authService.updateSystemSettings(parseResult.data);
      res.status(200).json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'ไม่สามารถอัปเดตการตั้งค่าได้' });
    }
  }
}

