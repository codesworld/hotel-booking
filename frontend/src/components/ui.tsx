// Small shared UI pieces. Every one takes a testId so tests can find it.
import type { ReactNode } from 'react';
import { STATUS_LABELS } from '../utils/format';

export function Alert({ kind, testId, children }: { kind: 'error' | 'success' | 'info'; testId: string; children: ReactNode }) {
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'} data-testid={testId}>
      {children}
    </div>
  );
}

export function FieldError({ testId, message }: { testId: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="field-error" data-testid={testId}>
      {message}
    </p>
  );
}

export function StatusBadge({ status, testId }: { status: string; testId: string }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`} data-testid={testId} data-status={status}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function Loading({ testId = 'loading' }: { testId?: string }) {
  return (
    <p className="muted" data-testid={testId} aria-busy="true">
      Loading…
    </p>
  );
}
