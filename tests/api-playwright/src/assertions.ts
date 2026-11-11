// Reusable assertions: status, JSON schema (shared files in tests/schemas) and error format.
import fs from 'node:fs';
import path from 'node:path';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { expect } from '@playwright/test';
import type { ApiResponse } from './api';

export type SchemaName =
  | 'error'
  | 'health'
  | 'user'
  | 'login-response'
  | 'room'
  | 'room-list'
  | 'availability-list'
  | 'booking'
  | 'booking-list'
  | 'payment'
  | 'quote';

const SCHEMA_DIR = path.resolve(__dirname, '..', '..', 'schemas');
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const compiled = new Map<SchemaName, ValidateFunction>();

function validator(name: SchemaName): ValidateFunction {
  if (!compiled.has(name)) {
    const schema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, `${name}.schema.json`), 'utf8'));
    compiled.set(name, ajv.compile(schema));
  }
  return compiled.get(name)!;
}

/** Fails the test if body does not match tests/schemas/<name>.schema.json. */
export function expectSchema(body: unknown, name: SchemaName) {
  const validate = validator(name);
  const valid = validate(body);
  expect(
    valid,
    `Body does not match ${name}.schema.json: ${ajv.errorsText(validate.errors)}\nBody: ${JSON.stringify(body)}`,
  ).toBe(true);
}

/** Status check whose failure message shows the response body. */
export function expectStatus(res: ApiResponse, status: number) {
  expect(res.status, `Unexpected status. Body: ${res.text}`).toBe(status);
}

/** Status + schema in one call. */
export function expectOk(res: ApiResponse, status: number, schema: SchemaName) {
  expectStatus(res, status);
  expectSchema(res.body, schema);
}

/** Status + standard error format + error.code (+ error.field when given). */
export function expectError(res: ApiResponse, status: number, code: string, field?: string) {
  expectStatus(res, status);
  expectSchema(res.body, 'error');
  expect(res.body.error.code).toBe(code);
  if (field !== undefined) expect(res.body.error.field).toBe(field);
}
