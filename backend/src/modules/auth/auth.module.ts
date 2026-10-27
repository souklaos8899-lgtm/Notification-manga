import { Module } from '@nestjs/common';
import { AuthController, SettingsController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController, SettingsController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}

