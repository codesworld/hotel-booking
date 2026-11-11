// Route guards. The API is the real protection (403/401); these only give a clear UI.
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/** Not logged in → login page, then back here after login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}

/** Logged in but not an admin → "access denied" page (not a silent redirect, so it can be tested). */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <section className="card" data-testid="access-denied">
        <h1 data-testid="access-denied-title">Access denied</h1>
        <p data-testid="access-denied-message">This page is only available to administrators.</p>
      </section>
    );
  }
  return <>{children}</>;
}
