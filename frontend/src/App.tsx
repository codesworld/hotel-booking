import { Link, Route, Routes } from 'react-router-dom';
import { RequireAdmin, RequireAuth } from './auth/guards';
import { Layout } from './components/Layout';
import { AdminRoomsPage } from './pages/AdminRoomsPage';
import { LoginPage } from './pages/LoginPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { RegisterPage } from './pages/RegisterPage';
import { RoomPage } from './pages/RoomPage';
import { SearchPage } from './pages/SearchPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<SearchPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="rooms/:id" element={<RoomPage />} />
        <Route path="bookings" element={<RequireAuth><MyBookingsPage /></RequireAuth>} />
        <Route path="admin/rooms" element={<RequireAuth><RequireAdmin><AdminRoomsPage /></RequireAdmin></RequireAuth>} />
        <Route
          path="*"
          element={
            <section className="card" data-testid="not-found">
              <h1>Page not found</h1>
              <Link to="/" data-testid="not-found-home">Back to search</Link>
            </section>
          }
        />
      </Route>
    </Routes>
  );
}
