import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute.jsx';
import { UnsupportedViewport } from './components/UnsupportedViewport/UnsupportedViewport.jsx';
import { useIsViewportSupported } from './hooks/useIsViewportSupported.js';
import { LoginPage } from './pages/LoginPage.jsx';
import { SignupPage } from './pages/SignupPage.jsx';
import { TracksPage } from './pages/TracksPage.jsx';
import { PlayPage } from './pages/PlayPage.jsx';
import { LeaderboardPage } from './pages/LeaderboardPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';

export function App() {
  const viewportSupported = useIsViewportSupported();

  if (!viewportSupported) {
    return <UnsupportedViewport />;
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/tracks" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/tracks" element={<TracksPage />} />
            <Route path="/play/:trackId" element={<PlayPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
