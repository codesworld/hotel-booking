import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <header className="topbar">
        <nav className="nav" data-testid="nav">
          <NavLink to="/" end className="brand" data-testid="nav-home">
            Hotel Booking
          </NavLink>
          <NavLink to="/" end data-testid="nav-search">Search</NavLink>
          {user && <NavLink to="/bookings" data-testid="nav-my-bookings">My bookings</NavLink>}
          {isAdmin && <NavLink to="/admin/rooms" data-testid="nav-admin-rooms">Admin: rooms</NavLink>}
          <span className="spacer" />
          {user ? (
            <>
              <span className="muted" data-testid="nav-user">
                {user.fullName}
                {isAdmin && <span className="role-tag" data-testid="nav-user-role">admin</span>}
              </span>
              <button
                className="link-button"
                data-testid="nav-logout"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" data-testid="nav-login">Log in</NavLink>
              <NavLink to="/register" data-testid="nav-register">Register</NavLink>
            </>
          )}
        </nav>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
