import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/endpoints';
import { Alert, FieldError } from '../components/ui';
import { errorField, errorMessage } from '../utils/errors';

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.register(form);
      navigate(`/login?registered=1&email=${encodeURIComponent(form.email)}`);
    } catch (err) {
      setError({ message: errorMessage(err), field: errorField(err) });
    } finally {
      setBusy(false);
    }
  }

  // A field error is shown next to its input; anything else at the top.
  const fieldMessage = (field: string) => (error?.field === field ? error.message : undefined);

  return (
    <section className="card narrow" data-testid="register-page">
      <h1>Create an account</h1>
      {error && !error.field && <Alert kind="error" testId="register-error">{error.message}</Alert>}

      <form onSubmit={submit} noValidate>
        <label>
          Full name
          <input value={form.fullName} onChange={update('fullName')} data-testid="register-full-name" />
        </label>
        <FieldError testId="register-error-fullName" message={fieldMessage('fullName')} />
        <label>
          Email
          <input type="email" value={form.email} onChange={update('email')} autoComplete="username" data-testid="register-email" />
        </label>
        <FieldError testId="register-error-email" message={fieldMessage('email')} />
        <label>
          Password <span className="muted">(8–72 characters)</span>
          <input type="password" value={form.password} onChange={update('password')} autoComplete="new-password" data-testid="register-password" />
        </label>
        <FieldError testId="register-error-password" message={fieldMessage('password')} />
        <button type="submit" disabled={busy} data-testid="register-submit">
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="muted">
        Already registered? <Link to="/login" data-testid="register-login-link">Log in</Link>
      </p>
    </section>
  );
}
