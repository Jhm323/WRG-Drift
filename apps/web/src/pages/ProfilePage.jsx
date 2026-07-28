import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { ApiError } from '../api/client.js';
import { AvatarPicker } from '../components/AvatarPicker/AvatarPicker.jsx';
import { ToneLevelPicker } from '../components/ToneLevelPicker/ToneLevelPicker.jsx';
import './ProfilePage.css';

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  // Pre-migration/never-set accounts default cleanly to 'professional' —
  // matches the DB column's own default, so there's no gap between what a
  // brand-new user sees here and what the server already assumes.
  const [toneLevel, setToneLevel] = useState(user.toneLevel ?? 'professional');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      await updateProfile({ displayName, avatarUrl, toneLevel });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="profile-page">
      <h1>Edit profile</h1>

      <form className="profile-page__form" onSubmit={handleSubmit}>
        {error && <p className="profile-page__error">{error}</p>}
        {saved && <p className="profile-page__saved">Saved.</p>}

        <label className="profile-page__field">
          <span className="profile-page__label">Email</span>
          <input className="profile-page__input" type="email" value={user.email} disabled />
        </label>

        <label className="profile-page__field">
          <span className="profile-page__label">Display name</span>
          <input
            className="profile-page__input"
            type="text"
            value={displayName}
            maxLength={50}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
        </label>

        <div className="profile-page__field">
          <span className="profile-page__label">Avatar</span>
          <AvatarPicker value={avatarUrl} onChange={setAvatarUrl} />
        </div>

        <div className="profile-page__field">
          <span className="profile-page__label">Character</span>
          <ToneLevelPicker value={toneLevel} onChange={setToneLevel} />
        </div>

        <div className="profile-page__actions">
          <button className="profile-page__submit" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
          <Link to="/tracks">Back to tracks</Link>
        </div>
      </form>
    </div>
  );
}
