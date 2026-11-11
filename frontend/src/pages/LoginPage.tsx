import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Alert } from '../components/ui';
import { errorMessage } from '../utils/errors';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate(params.get('next') ?? '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card narrow" data-testid="login-page">
      <h1>Log in</h1>
      {params.get('expired') && (
        <Alert kind="info" testId="login-session-expired">Your session has expired. Please log in again.</Alert>
      )}
      {params.get('registered') && (
        <Alert kind="success" testId="login-registered">Account created. You can log in now.</Alert>
      )}
      {error && <Alert kind="error" testId="login-error">{error}</Alert>}

      <form onSubmit={submit} noValidate>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required data-testid="login-email" />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required data-testid="login-password" />
        </label>
        <button type="submit" disabled={busy} data-testid="login-submit">
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="muted">
        No account? <Link to="/register" data-testid="login-register-link">Register</Link>
      </p>
    </section>
  );
}
