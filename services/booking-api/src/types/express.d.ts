// Adds the logged-in user to Express' Request type (set by the auth middleware).
import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}

export {};
