import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { ApiError } from '../../api/client.js';
import { resendVerification } from '../../api/auth.js';
import './LoginForm.css';

// Matches the one HttpError(403, ...) status auth.service.js's login() ever
// throws — "please verify your email" — so this is an unambiguous signal to
// gate the resend link on, without string-matching the message itself.
const UNVERIFIED_STATUS = 403;

export function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendStatus, setResendStatus] = useState(null); // null | 'sending' | 'sent' | 'failed'

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setResendStatus(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate('/tracks');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setNeedsVerification(err.status === UNVERIFIED_STATUS);
      } else {
        setError('Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResendStatus('sending');
    try {
      await resendVerification({ email });
      setResendStatus('sent');
    } catch {
      setResendStatus('failed');
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <h1 className="login-form__title">Log in</h1>

      {error && <p className="login-form__error">{error}</p>}

      {needsVerification && (
        <p className="login-form__resend">
          {resendStatus === 'sent' ? (
            'If that account needs verification, a new link has been sent.'
          ) : (
            <>
              Didn&rsquo;t get the email?{' '}
              <button
                type="button"
                className="login-form__resend-link"
                onClick={handleResend}
                disabled={resendStatus === 'sending'}
              >
                {resendStatus === 'sending' ? 'Sending…' : 'Resend verification email'}
              </button>
              {resendStatus === 'failed' && ' — something went wrong, try again.'}
            </>
          )}
        </p>
      )}

      <label className="login-form__field">
        <span className="login-form__label">Email</span>
        <input
          className="login-form__input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      <label className="login-form__field">
        <span className="login-form__label">Password</span>
        <input
          className="login-form__input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>

      <button className="login-form__submit" type="submit" disabled={submitting}>
        {submitting ? 'Logging in…' : 'Log in'}
      </button>

      <p className="login-form__footer">
        No account? <Link to="/signup">Sign up</Link>
      </p>
    </form>
  );
}
