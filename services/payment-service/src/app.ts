// Simulated payment provider. The card token decides what happens:
//
//   tok_success → 201 APPROVED
//   tok_decline → 402 DECLINED
//   tok_slow    → waits PAYMENT_SLOW_MS (5 s), then 201 APPROVED
//   tok_error   → 500
//   anything else → 400
//
// Errors use the same JSON format as booking-api:
//   { "error": { "code": "...", "message": "...", "field?": "...", "details?": {...} } }
import path from 'node:path';
import fs from 'node:fs';
import express, { type NextFunction, type Request, type Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { z } from 'zod';
import { config } from './config';
import { findPayment, savePayment } from './store';

function sendError(res: Response, status: number, code: string, message: string, extra: object = {}) {
  res.status(status).json({ error: { code, message, ...extra } });
}

const paymentRequestSchema = z
  .object({
    bookingId: z.string().min(1),
    amount: z
      .number()
      .positive()
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9, 'must have at most 2 decimal places'),
    cardToken: z.string().min(1),
  })
  .strict();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  const spec = YAML.parse(fs.readFileSync(path.join(__dirname, '..', 'openapi.yaml'), 'utf8'));
  app.get('/docs/openapi.json', (_req, res) => {
    res.json(spec);
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'payment-service' });
  });

  app.post('/payments', async (req, res) => {
    const parsed = paymentRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue.code === 'unrecognized_keys' ? issue.keys[0] : issue.path.join('.');
      return sendError(res, 400, 'VALIDATION_ERROR', `${field}: ${issue.message}`, { field });
    }
    const { bookingId, amount, cardToken } = parsed.data;

    switch (cardToken) {
      case 'tok_success': {
        const payment = savePayment(bookingId, amount, 'APPROVED');
        return res.status(201).location(`/payments/${payment.id}`).json(payment);
      }
      case 'tok_decline': {
        const payment = savePayment(bookingId, amount, 'DECLINED');
        return sendError(res, 402, 'PAYMENT_DECLINED', 'Card was declined', { details: { payment } });
      }
      case 'tok_slow': {
        await sleep(config.slowResponseMs);
        const payment = savePayment(bookingId, amount, 'APPROVED');
        return res.status(201).location(`/payments/${payment.id}`).json(payment);
      }
      case 'tok_error':
        return sendError(res, 500, 'INTERNAL_ERROR', 'Simulated payment provider failure');
      default:
        return sendError(res, 400, 'INVALID_CARD_TOKEN', 'Unknown card token', { field: 'cardToken' });
    }
  });

  app.get('/payments/:id', (req, res) => {
    const payment = findPayment(String(req.params.id));
    if (!payment) return sendError(res, 404, 'NOT_FOUND', 'Payment not found');
    res.json(payment);
  });

  app.use((req: Request, res: Response) => {
    sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`);
  });

  // Express recognises error handlers by their 4 arguments, so `_next` must stay.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if ((err as { type?: string })?.type === 'entity.parse.failed') {
      return sendError(res, 400, 'INVALID_JSON', 'Request body is not valid JSON');
    }
    console.error('Unhandled error:', err);
    sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  });

  return app;
}
