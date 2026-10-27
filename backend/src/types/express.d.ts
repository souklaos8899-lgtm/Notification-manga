import { UserProfileDto } from './contract';

declare global {
  namespace Express {
    interface Request {
      user?: UserProfileDto | null;
    }
  }
}

export {};

