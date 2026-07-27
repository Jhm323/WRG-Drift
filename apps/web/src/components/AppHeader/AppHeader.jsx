import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import './AppHeader.css';

function navLinkClass({ isActive }) {
  return isActive ? 'app-header__link app-header__link--active' : 'app-header__link';
}

export function AppHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="app-header">
      <span className="app-header__brand">DirtCar Drift</span>

      <nav className="app-header__nav">
        <NavLink className={navLinkClass} to="/tracks">
          Tracks
        </NavLink>
        <NavLink className={navLinkClass} to="/leaderboard">
          Leaderboard
        </NavLink>
      </nav>

      <div className="app-header__user">
        <Link className="app-header__profile-link" to="/profile" aria-label="Edit profile">
          <img className="app-header__avatar" src={user.avatarUrl} alt="" />
          <span className="app-header__name">{user.displayName}</span>
        </Link>
        <button className="app-header__logout" type="button" onClick={logout}>
          Log out
        </button>
      </div>
    </header>
  );
}
