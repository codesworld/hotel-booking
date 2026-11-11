// Turns every error into the standard JSON error format.
// Never returns HTML and never leaks a stack trace.
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors';

export function sendError(res: Response, err: AppError) {
  res.status(err.status).json({
    error: {
      code: err.code,
      message: err.message,
      ...(err.field !== undefined && { field: err.field }),
      ...(err.details !== undefined && { details: err.details }),
    },
  });
}

/** Rejects bodies that are not JSON (only when a body is actually sent). */
export function requireJsonBody(req: Request, _res: Response, next: NextFunction) {
  const hasBody =
    (req.headers['content-length'] !== undefined && req.headers['content-length'] !== '0') ||
    req.headers['transfer-encoding'] !== undefined;

  if (['POST', 'PUT', 'PATCH'].includes(req.method) && hasBody && !req.is('application/json')) {
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
  }
  next();
}

/** Any route that does not exist. */
export function notFoundHandler(req: Request, res: Response) {
  sendError(res, new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));
}

// Express recognises error handlers by their 4 arguments, so `_next` must stay.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return sendError(res, err);
  }

  // Errors raised by express.json()
  const type = (err as { type?: string })?.type;
  if (type === 'entity.parse.failed') {
    return sendError(res, new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON'));
  }
  if (type === 'entity.too.large') {
    return sendError(res, new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large'));
  }
  if (type === 'charset.unsupported' || type === 'encoding.unsupported') {
    return sendError(res, new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported request encoding'));
  }

  console.error('Unhandled error:', err);
  return sendError(res, new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred'));
}
