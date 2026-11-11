// All configuration comes from environment variables.

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable ${name} must be a number, got "${raw}"`);
  }
  return value;
}

export const config = {
  port: optionalNumber('PORT', 4000),
  // How long tok_slow waits before answering (the plan says 5 seconds).
  slowResponseMs: optionalNumber('PAYMENT_SLOW_MS', 5000),
};
