
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';

const CODE_LENGTH = 6;
const POLL_INTERVAL = 2000;

function errorMessage(error) {
  return error?.message || 'Something went wrong. Please try again.';
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validPhone(value) {
  return /^\+[1-9]\d{7,14}$/.test(value.replace(/[\s()-]/g, ''));
}

function validCode(value) {
  return /^\d{6}$/.test(value.trim());
}

function Message({ children, type = 'error' }) {
  if (!children) return null;

  return (
    <div
      className={`login-message ${type}`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      {children}
    </div>
  );
}

function LoadingButton({ loading, children, className = 'login-primary' }) {
  return (
    <button
      className={className}
      type="submit"
      disabled={loading}
    >
      {loading ? (
        <>
          <span className="login-spinner" aria-hidden="true" />
          Please wait...
        </>
      ) : children}
    </button>
  );
}

export default function Login() {
  const [who, setWho] = useState('customer');

  return (
    <main className="login-page">
      <style>{`
        .login-page {
          --login-accent: #a87950;
          --login-accent-dark: #805735;
          --login-text: #292521;
          --login-muted: #858078;
          --login-border: #e9e5df;
          --login-bg: #faf9f7;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 18px;
          background: var(--login-bg);
          color: var(--login-text);
          font-family: inherit;
          box-sizing: border-box;
        }

        .login-page *,
        .login-page *::before,
        .login-page *::after {
          box-sizing: border-box;
        }

        .login-shell {
          width: 100%;
          max-width: 440px;
          margin: auto;
        }

        .login-brand {
          text-align: center;
          margin-bottom: 28px;
        }

        .login-brand-icon {
          width: 58px;
          height: 58px;
          margin: 0 auto 14px;
          display: grid;
          place-items: center;
          border-radius: 18px;
          background: #eee5dc;
          color: var(--login-accent-dark);
          font-size: 26px;
        }

        .login-brand h1 {
          font-size: 26px;
          font-weight: 750;
          letter-spacing: -0.8px;
          margin: 0 0 7px;
        }

        .login-brand p {
          font-size: 14px;
          color: var(--login-muted);
          margin: 0;
        }

        .login-card {
          background: #fff;
          border-radius: 20px;
          padding: 30px;
          box-shadow: 0 12px 45px rgba(45, 35, 25, .055);
        }

        .login-heading {
          margin-bottom: 24px;
        }

        .login-heading h2 {
          font-size: 21px;
          margin: 0 0 7px;
          font-weight: 700;
        }

        .login-heading p {
          font-size: 13px;
          color: var(--login-muted);
          margin: 0;
          line-height: 1.6;
        }

        .login-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          padding: 4px;
          background: #f4f2ef;
          border-radius: 12px;
          gap: 4px;
          margin-bottom: 25px;
        }

        .login-tabs button {
          border: 0;
          border-radius: 9px;
          padding: 12px 8px;
          background: transparent;
          color: #77716a;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: .2s ease;
        }

        .login-tabs button.active {
          background: white;
          color: var(--login-accent-dark);
          box-shadow: 0 2px 7px rgba(0,0,0,.06);
        }

        .login-methods {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 22px;
        }

        .login-methods button {
          flex: 1;
          min-width: 90px;
          padding: 10px 8px;
          border: 1px solid var(--login-border);
          border-radius: 9px;
          background: white;
          color: #716b64;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: .2s ease;
        }

        .login-methods button.active {
          color: var(--login-accent-dark);
          border-color: var(--login-accent);
          background: #faf5ef;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 17px;
        }

        .login-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .login-field label {
          font-size: 13px;
          font-weight: 650;
          color: #49443e;
        }

        .login-field input {
          width: 100%;
          min-height: 48px;
          padding: 12px 14px;
          border: 1px solid var(--login-border);
          border-radius: 10px;
          background: #fff;
          color: var(--login-text);
          font: inherit;
          font-size: 14px;
          outline: none;
          transition: .2s ease;
        }

        .login-field input:focus {
          border-color: var(--login-accent);
          box-shadow: 0 0 0 3px rgba(168,121,80,.12);
        }

        .login-field input:disabled {
          background: #f6f5f3;
          cursor: not-allowed;
        }

        .login-primary {
          width: 100%;
          min-height: 49px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 12px;
          border: none;
          border-radius: 10px;
          background: var(--login-accent);
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: .2s ease;
        }

        .login-primary:hover:not(:disabled) {
          background: var(--login-accent-dark);
          transform: translateY(-1px);
        }

        .login-primary:disabled {
          opacity: .65;
          cursor: not-allowed;
        }

        .login-secondary {
          min-height: 42px;
          padding: 9px 12px;
          border: 1px solid var(--login-border);
          border-radius: 9px;
          background: white;
          color: #716b64;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .login-secondary:hover:not(:disabled) {
          background: #f8f6f3;
        }

        .login-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .login-message {
          padding: 12px 13px;
          border-radius: 9px;
          font-size: 13px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .login-message.error {
          background: #fff1f0;
          color: #b33b32;
        }

        .login-message.success {
          background: #edf8f0;
          color: #287542;
        }

        .login-note {
          color: var(--login-muted);
          font-size: 12px;
          line-height: 1.6;
          margin: 0;
        }

        .login-spinner {
          width: 15px;
          height: 15px;
          border: 2px solid rgba(255,255,255,.4);
          border-top-color: white;
          border-radius: 50%;
          animation: login-spin .7s linear infinite;
        }

        @keyframes login-spin {
          to { transform: rotate(360deg); }
        }

        .login-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 23px 0;
          color: #aaa39b;
          font-size: 11px;
        }

        .login-divider::before,
        .login-divider::after {
          content: "";
          height: 1px;
          flex: 1;
          background: var(--login-border);
        }

        .login-whatsapp {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          width: 100%;
          min-height: 48px;
          border-radius: 10px;
          background: #f0f8f1;
          color: #258347;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
        }

        .login-footer {
          text-align: center;
          margin-top: 23px;
          color: var(--login-muted);
          font-size: 12px;
        }

        .login-back {
          border: none;
          padding: 5px 0;
          background: none;
          color: var(--login-accent-dark);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          align-self: flex-start;
        }

        .login-loading {
          text-align: center;
          color: var(--login-muted);
          font-size: 13px;
          padding: 25px 0;
        }

        @media (max-width: 480px) {
          .login-page {
            padding: 20px 14px;
            align-items: flex-start;
          }

          .login-shell {
            margin: auto;
          }

          .login-brand {
            margin-bottom: 22px;
          }

          .login-card {
            padding: 23px 19px;
            border-radius: 16px;
          }

          .login-brand h1 {
            font-size: 23px;
          }

          .login-heading h2 {
            font-size: 19px;
          }
        }
      `}</style>

      <div className="login-shell">
        <header className="login-brand">
          <div className="login-brand-icon" aria-hidden="true">
            ✦
          </div>
          <h1>Welcome to the Salon</h1>
          <p>Your beauty and wellness experience starts here.</p>
        </header>

        <section className="login-card">
          <div className="login-heading">
            <h2>Sign in to continue</h2>
            <p>Choose your account type to access your dashboard.</p>
          </div>

          <div className="login-tabs" role="tablist" aria-label="Account type">
            <button
              type="button"
              role="tab"
              aria-selected={who === 'customer'}
              className={who === 'customer' ? 'active' : ''}
              onClick={() => setWho('customer')}
            >
              Customer
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={who === 'staff'}
              className={who === 'staff' ? 'active' : ''}
              onClick={() => setWho('staff')}
            >
              Staff sign-in
            </button>
          </div>

          {who === 'customer' ? <CustomerLogin /> : <StaffLogin />}
        </section>

        <footer className="login-footer">
          Secure sign-in · Your information is protected
        </footer>
      </div>
    </main>
  );
}

// --------------------------------------------------
// CUSTOMER LOGIN METHOD CONFIGURATION
// --------------------------------------------------

function CustomerLogin() {
  const [cfg, setCfg] = useState(null);
  const [method, setMethod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await api('/auth/wa/config');

      setCfg(data);

      const available = [
        data.email && 'email',
        data.whatsapp && 'whatsapp',
        data.otp && 'phone',
      ].filter(Boolean);

      setMethod((current) =>
        available.includes(current) ? current : available[0] || null
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  if (loading) {
    return <div className="login-loading">Loading sign-in options...</div>;
  }

  if (error) {
    return (
      <div className="login-form">
        <Message>{error}</Message>
        <button className="login-primary" onClick={loadConfig}>
          Try again
        </button>
      </div>
    );
  }

  const methods = [
    cfg.email && { key: 'email', label: 'Email' },
    cfg.whatsapp && { key: 'whatsapp', label: 'WhatsApp' },
    cfg.otp && { key: 'phone', label: 'Phone OTP' },
  ].filter(Boolean);

  if (!methods.length) {
    return (
      <Message type="success">
        Customer sign-in is not currently available. Please contact the salon.
      </Message>
    );
  }

  return (
    <>
      {methods.length > 1 && (
        <div className="login-methods" role="tablist" aria-label="Sign-in method">
          {methods.map((item) => (
            <button
              type="button"
              key={item.key}
              role="tab"
              aria-selected={method === item.key}
              className={method === item.key ? 'active' : ''}
              onClick={() => setMethod(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {method === 'email' && <EmailLogin />}
      {method === 'whatsapp' && <WhatsAppLogin />}
      {method === 'phone' && <CodeLogin />}
    </>
  );
}

// --------------------------------------------------
// EMAIL LOGIN
// --------------------------------------------------

function EmailLogin() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  const from = location.state?.from;

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requestCode = async (e) => {
    e.preventDefault();
    setError('');
    setHint('');

    if (!validEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      const data = await api('/auth/email/request', {
        method: 'POST',
        body: { email: email.trim().toLowerCase() },
      });

      setSent(true);

      if (data.devCode) {
        setHint(`Development mode: your verification code is ${data.devCode}`);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    setError('');

    if (!validCode(code)) {
      setError('Enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);

    try {
      const data = await api('/auth/email/verify', {
        method: 'POST',
        body: {
          email: email.trim().toLowerCase(),
          code: code.trim(),
          name: name.trim() || undefined,
        },
      });

      setUser(data.user);
      nav(from?.pathname || '/book', { state: from?.state });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  if (!sent) {
    return (
      <form className="login-form" onSubmit={requestCode}>
        <div className="login-field">
          <label htmlFor="customer-email">Email address</label>
          <input
            id="customer-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            disabled={loading}
          />
        </div>

        <div className="login-field">
          <label htmlFor="customer-name">Your name (first visit only)</label>
          <input
            id="customer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            autoComplete="name"
            disabled={loading}
          />
        </div>

        <Message>{error}</Message>

        <LoadingButton loading={loading}>
          Email me a verification code
        </LoadingButton>

        <p className="login-note">
          We will send a one-time verification code to your email address.
        </p>
      </form>
    );
  }

  return (
    <form className="login-form" onSubmit={verifyCode}>
      <p className="login-note">
        We sent a 6-digit verification code to <strong>{email}</strong>.
        Check your spam folder if it does not arrive.
      </p>

      {hint && <Message type="success">{hint}</Message>}

      <div className="login-field">
        <label htmlFor="email-code">Verification code</label>
        <input
          id="email-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          inputMode="numeric"
          maxLength={CODE_LENGTH}
          autoComplete="one-time-code"
          placeholder="000000"
          required
          disabled={loading}
        />
      </div>

      <Message>{error}</Message>

      <LoadingButton loading={loading}>Verify and sign in</LoadingButton>

      <button
        type="button"
        className="login-secondary"
        disabled={loading}
        onClick={() => {
          setSent(false);
          setCode('');
          setError('');
          setHint('');
        }}
      >
        Use a different email
      </button>
    </form>
  );
}

// --------------------------------------------------
// WHATSAPP LOGIN
// --------------------------------------------------

function WhatsAppLogin() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  const from = location.state?.from;

  const [stage, setStage] = useState('idle');
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const secret = useRef('');
  const nameRef = useRef('');

  nameRef.current = name;

  const start = async () => {
    setError('');
    setLoading(true);

    try {
      const data = await api('/auth/wa/start', {
        method: 'POST',
        body: {},
      });

      if (!data.secret || !data.link) {
        throw new Error('The server returned an incomplete WhatsApp login response.');
      }

      secret.current = data.secret;
      setLink(data.link);
      setStage('waiting');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (stage !== 'waiting') return;

    let active = true;
    let timer;

    const poll = async () => {
      if (!active) return;

      try {
        const data = await api('/auth/wa/check', {
          method: 'POST',
          body: {
            secret: secret.current,
            name: nameRef.current.trim() || undefined,
          },
        });

        if (!active) return;

        if (data.needName) {
          setStage('name');
          return;
        }

        if (data.user) {
          setUser(data.user);
          nav(from?.pathname || '/book', {
            state: from?.state,
          });
          return;
        }

        timer = setTimeout(poll, POLL_INTERVAL);
      } catch (e) {
        if (active) {
          setError(errorMessage(e));
          setStage('idle');
        }
      }
    };

    poll();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [stage, setUser, nav, from?.pathname, from?.state]);

  if (stage === 'idle') {
    return (
      <div className="login-form">
        <p className="login-note">
          Sign in using your WhatsApp number. We will open a ready-made
          message. Simply press Send in WhatsApp.
        </p>

        <Message>{error}</Message>

        <button
          type="button"
          className="login-primary"
          disabled={loading}
          onClick={start}
        >
          {loading ? (
            <>
              <span className="login-spinner" />
              Connecting...
            </>
          ) : (
            'Continue with WhatsApp'
          )}
        </button>
      </div>
    );
  }

  if (stage === 'name') {
    return (
      <form
        className="login-form"
        onSubmit={(e) => {
          e.preventDefault();

          if (name.trim().length < 2) {
            setError('Please enter a name with at least 2 characters.');
            return;
          }

          setError('');
          setStage('waiting');
        }}
      >
        <p className="login-note">
          Your WhatsApp number has been confirmed. What should we call you?
        </p>

        <div className="login-field">
          <label htmlFor="whatsapp-name">Your name</label>
          <input
            id="whatsapp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Your full name"
            required
          />
        </div>

        <Message>{error}</Message>

        <LoadingButton loading={false}>Continue</LoadingButton>
      </form>
    );
  }

  return (
    <div className="login-form">
      <div className="login-message success">
        Waiting for your WhatsApp message...
      </div>

      <p className="login-note">
        Open WhatsApp and press Send on the prepared message.
        Return here afterwards. We will sign you in automatically.
      </p>

      <a
        className="login-whatsapp"
        href={link}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open WhatsApp
      </a>

      <button
        type="button"
        className="login-secondary"
        onClick={() => {
          secret.current = '';
          setStage('idle');
          setError('');
        }}
      >
        Cancel
      </button>
    </div>
  );
}

// --------------------------------------------------
// PHONE OTP LOGIN
// --------------------------------------------------

function CodeLogin() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  const from = location.state?.from;

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requestCode = async (e) => {
    e.preventDefault();
    setError('');
    setHint('');

    if (!validPhone(phone)) {
      setError('Enter a valid international phone number, including country code. Example: +9601234567');
      return;
    }

    setLoading(true);

    try {
      const data = await api('/auth/otp/request', {
        method: 'POST',
        body: {
          phone: phone.replace(/[\s()-]/g, ''),
        },
      });

      setSent(true);

      if (data.devCode) {
        setHint(`Development mode: your verification code is ${data.devCode}`);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    setError('');

    if (!validCode(code)) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    setLoading(true);

    try {
      const data = await api('/auth/otp/verify', {
        method: 'POST',
        body: {
          phone: phone.replace(/[\s()-]/g, ''),
          code: code.trim(),
          name: name.trim() || undefined,
        },
      });

      setUser(data.user);
      nav(from?.pathname || '/book', {
        state: from?.state,
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  if (!sent) {
    return (
      <form className="login-form" onSubmit={requestCode}>
        <div className="login-field">
          <label htmlFor="customer-phone">Phone number</label>
          <input
            id="customer-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+960 1234567"
            inputMode="tel"
            autoComplete="tel"
            required
            disabled={loading}
          />
        </div>

        <div className="login-field">
          <label htmlFor="phone-name">Your name (first visit only)</label>
          <input
            id="phone-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            autoComplete="name"
            disabled={loading}
          />
        </div>

        <Message>{error}</Message>

        <LoadingButton loading={loading}>
          Send verification code
        </LoadingButton>

        <p className="login-note">
          Include your international country code when entering your number.
        </p>
      </form>
    );
  }

  return (
    <form className="login-form" onSubmit={verifyCode}>
      <p className="login-note">
        Enter the 6-digit code sent to <strong>{phone}</strong>.
      </p>

      {hint && <Message type="success">{hint}</Message>}

      <div className="login-field">
        <label htmlFor="phone-code">Verification code</label>
        <input
          id="phone-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          inputMode="numeric"
          maxLength={CODE_LENGTH}
          autoComplete="one-time-code"
          placeholder="000000"
          required
          disabled={loading}
        />
      </div>

      <Message>{error}</Message>

      <LoadingButton loading={loading}>Verify and sign in</LoadingButton>

      <button
        type="button"
        className="login-secondary"
        disabled={loading}
        onClick={() => {
          setSent(false);
          setCode('');
          setHint('');
          setError('');
        }}
      >
        Change phone number
      </button>
    </form>
  );
}

// --------------------------------------------------
// STAFF LOGIN
// --------------------------------------------------

function StaffLogin() {
  const { setUser } = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validEmail(email)) {
      setError('Please enter a valid staff email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      const data = await api('/auth/staff/login', {
        method: 'POST',
        body: {
          email: email.trim().toLowerCase(),
          password,
        },
      });

      if (!data.user) {
        throw new Error('The server did not return a valid user account.');
      }

      setUser(data.user);
      nav('/staff');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="login-form" onSubmit={submit}>
      <div className="login-heading">
        <h2>Staff access</h2>
        <p>Sign in using your authorized salon staff account.</p>
      </div>

      <div className="login-field">
        <label htmlFor="staff-email">Email address</label>
        <input
          id="staff-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="staff@example.com"
          autoComplete="username"
          required
          disabled={loading}
        />
      </div>

      <div className="login-field">
        <label htmlFor="staff-password">Password</label>
        <input
          id="staff-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
          disabled={loading}
        />
      </div>

      <Message>{error}</Message>

      <LoadingButton loading={loading}>
        Sign in to staff dashboard
      </LoadingButton>

      <p className="login-note">
        Staff accounts are managed by the salon administrator.
      </p>
    </form>
  );
}
