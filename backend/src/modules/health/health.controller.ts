import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class HealthController {
  @Get('health')
  getHealth(@Res() res: Response): void {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  }
}

