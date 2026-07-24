import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { AppHeader } from '../AppHeader/AppHeader.jsx';

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <AppHeader />
      <main className="app-main">
        <Outlet />
      </main>
    </>
  );
}
