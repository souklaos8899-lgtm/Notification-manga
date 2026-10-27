import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { config } from './config';

export async function createApp(): Promise<any> {
  const nestApp = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
  });

  nestApp.use((_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  nestApp.enableCors({
    origin: config.corsOrigins,
    credentials: true,
  });

  nestApp.use(cookieParser());
  nestApp.useGlobalFilters(new AllExceptionsFilter());

  await nestApp.init();

  return nestApp.getHttpAdapter().getInstance();
}
