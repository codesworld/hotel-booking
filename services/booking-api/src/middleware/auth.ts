// JWT authentication.
//   401 = missing / malformed / invalid / expired token
//   403 = valid token but not allowed (see requireAdmin)
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { config } from '../config';
import { prisma } from '../db';
import { AppError, forbidden } from '../errors';

export function signAccessToken(user: User): { token: string; expiresIn: number } {
  const token = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwtExpiresIn,
  });
  const decoded = jwt.decode(token) as { iat: number; exp: number };
  return { token, expiresIn: decoded.exp - decoded.iat };
}

/** Reads the Bearer token and returns the user it belongs to. Throws 401 on any problem. */
async function authenticate(req: Request) {
  const header = req.header('Authorization');
  if (!header) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required: send an Authorization: Bearer <token> header');
  }

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    throw new AppError(401, 'INVALID_TOKEN', 'Authorization header must have the format: Bearer <token>');
  }

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(parts[1], config.jwtSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Access token has expired');
    }
    throw new AppError(401, 'INVALID_TOKEN', 'Access token is invalid');
  }

  // The role is always taken from the database, never trusted from the token.
  const user = typeof payload.sub === 'string' ? await prisma.user.findUnique({ where: { id: payload.sub } }) : null;
  if (!user) {
    throw new AppError(401, 'INVALID_TOKEN', 'Access token is invalid');
  }
  return { id: user.id, role: user.role };
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = await authenticate(req);
  next();
}

/** For public endpoints that behave differently for admins. A bad token is simply ignored. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  if (req.header('Authorization')) {
    try {
      req.user = await authenticate(req);
    } catch {
      req.user = undefined;
    }
  }
  next();
}

/** Must come after requireAuth. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') {
    throw forbidden('Admin role required');
  }
  next();
}
