import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { ApiError } from '../../api/client.js';
import { AvatarPicker, AVATAR_OPTIONS } from '../AvatarPicker/AvatarPicker.jsx';
import './SignupForm.css';

export function SignupForm() {
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(AVATAR_OPTIONS[0]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup({ email, password, displayName, avatarUrl });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="signup-form signup-form--done">
        <h1 className="signup-form__title">Check your inbox</h1>
        <p>We sent a verification link to {email}. Verify it, then log in.</p>
        <p className="signup-form__footer">
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    );
  }

  return (
    <form className="signup-form" onSubmit={handleSubmit}>
      <h1 className="signup-form__title">Sign up</h1>

      {error && <p className="signup-form__error">{error}</p>}

      <label className="signup-form__field">
        <span className="signup-form__label">Email (@dirtcar.com)</span>
        <input
          className="signup-form__input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      <label className="signup-form__field">
        <span className="signup-form__label">Display name</span>
        <input
          className="signup-form__input"
          type="text"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
        />
      </label>

      <label className="signup-form__field">
        <span className="signup-form__label">Password</span>
        <input
          className="signup-form__input"
          type="password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>

      <div className="signup-form__field">
        <span className="signup-form__label">Avatar</span>
        <AvatarPicker value={avatarUrl} onChange={setAvatarUrl} />
      </div>

      <button className="signup-form__submit" type="submit" disabled={submitting}>
        {submitting ? 'Signing up…' : 'Sign up'}
      </button>

      <p className="signup-form__footer">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </form>
  );
}
