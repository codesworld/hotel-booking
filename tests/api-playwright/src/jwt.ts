// Builds JWTs for the token tests (expired, tampered, forged, unsigned).
import { createHmac } from 'node:crypto';

const b64url = (value: object | string) =>
  Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** A correctly signed HS256 token. */
export function signToken(payload: object, secret: string): string {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url(payload);
  const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

/** Payload for user `sub` that expired 10 seconds ago. */
export const expiredPayload = (sub: string, role: string) => ({ sub, role, iat: nowSeconds() - 1000, exp: nowSeconds() - 10 });

/** Payload valid for the next 10 minutes. */
export const validPayload = (sub: string, role: string) => ({ sub, role, iat: nowSeconds(), exp: nowSeconds() + 600 });

/** Changes payload fields but keeps the ORIGINAL signature (so the signature no longer matches). */
export function tamperToken(token: string, changes: object): string {
  const [header, payload, signature] = token.split('.');
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  return `${header}.${b64url({ ...decoded, ...changes })}.${signature}`;
}

/** An "alg: none" token with an empty signature. */
export function unsignedToken(payload: object): string {
  return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(payload)}.`;
}
