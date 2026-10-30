import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';

export default function Login() {
  const [who, setWho] = useState('customer');
  return (
    <section className="step">
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={who === 'customer'} onClick={() => setWho('customer')}>I’m a customer</button>
        <button role="tab" aria-selected={who === 'staff'} onClick={() => setWho('staff')}>Staff sign-in</button>
      </div>
      {who === 'customer' ? <CustomerLogin /> : <StaffLogin />}
    </section>
  );
}

// Shows whichever customer sign-in methods the server has switched on.
function CustomerLogin() {
  const [cfg, setCfg] = useState(null), [m, setM] = useState(null);
  useEffect(() => {
    api('/auth/wa/config').then((c) => { setCfg(c); setM(c.email ? 'email' : c.whatsapp ? 'whatsapp' : c.otp ? 'phone' : null); })
      .catch(() => { setCfg({ email: true }); setM('email'); });
  }, []);
  if (!cfg) return <p className="muted">Loading…</p>;
  const methods = [cfg.email && ['email', 'Email'], cfg.whatsapp && ['whatsapp', 'WhatsApp'], cfg.otp && ['phone', 'Phone code']].filter(Boolean);
  if (!methods.length) return <p className="note">Customer sign-in isn’t set up yet. Please call the salon to book.</p>;
  return (
    <>
      {methods.length > 1 && (
        <div className="chips" role="tablist" aria-label="Sign-in method">
          {methods.map(([k, label]) => <button key={k} role="tab" aria-selected={m === k} onClick={() => setM(k)}>{label}</button>)}
        </div>
      )}
      {m === 'email' && <EmailLogin />}
      {m === 'whatsapp' && <WhatsAppLogin />}
      {m === 'phone' && <CodeLogin />}
    </>
  );
}

function EmailLogin() {
  const { setUser } = useAuth(); const nav = useNavigate();
  const from = useLocation().state?.from;
  const [email, setEmail] = useState(''), [name, setName] = useState(''), [code, setCode] = useState('');
  const [sent, setSent] = useState(false), [hint, setHint] = useState(''), [err, setErr] = useState('');
  const run = (fn) => async (e) => { e.preventDefault(); setErr(''); try { await fn(); } catch (x) { setErr(x.message); } };

  const request = run(async () => {
    const d = await api('/auth/email/request', { method: 'POST', body: { email } });
    setSent(true); if (d.devCode) setHint(`Test mode: your code is ${d.devCode}`);
  });
  const verify = run(async () => {
    const d = await api('/auth/email/verify', { method: 'POST', body: { email, code, name: name || undefined } });
    setUser(d.user); nav(from?.pathname || '/book', { state: from?.state });
  });

  return !sent ? (
    <form onSubmit={request}>
      <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
      <label>Your name (first visit only)<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
      <p className="err" role="alert">{err}</p>
      <button className="cta">Email me a code</button>
    </form>
  ) : (
    <form onSubmit={verify}>
      <p>We emailed a 6-digit code to {email}. Check your spam folder if it doesn’t arrive.</p>
      {hint && <p className="note">{hint}</p>}
      <label>Code<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} autoComplete="one-time-code" required /></label>
      <p className="err" role="alert">{err}</p>
      <button className="cta">Sign in</button>
      <button type="button" className="ghost" onClick={() => setSent(false)}>Use a different email</button>
    </form>
  );
}

function WhatsAppLogin() {
  const { setUser } = useAuth(); const nav = useNavigate();
  const from = useLocation().state?.from;
  const [stage, setStage] = useState('idle'), [name, setName] = useState(''), [link, setLink] = useState(''), [err, setErr] = useState('');
  const secret = useRef(''), nameRef = useRef('');
  nameRef.current = name;

  const start = async () => {
    setErr('');
    try {
      const d = await api('/auth/wa/start', { method: 'POST', body: {} });
      secret.current = d.secret; setLink(d.link); setStage('waiting');
      window.open(d.link, '_blank', 'noopener');
    } catch (e) { setErr(e.message); }
  };

  // While waiting, ask the server every 2 seconds whether the WhatsApp message has arrived.
  useEffect(() => {
    if (stage !== 'waiting') return;
    const t = setInterval(async () => {
      try {
        const d = await api('/auth/wa/check', { method: 'POST', body: { secret: secret.current, name: nameRef.current || undefined } });
        if (d.needName) setStage('name');
        else if (d.user) { clearInterval(t); setUser(d.user); nav(from?.pathname || '/book', { state: from?.state }); }
      } catch (e) { clearInterval(t); setErr(e.message); setStage('idle'); }
    }, 2000);
    return () => clearInterval(t);
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (stage === 'idle') return (
    <div>
      <button className="cta" onClick={start}>Continue with WhatsApp</button>
      <p className="muted">We’ll open WhatsApp with a ready-made message. Just press send. No code to type.</p>
      <p className="err" role="alert">{err}</p>
    </div>
  );
  if (stage === 'name') return (
    <form onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2) setStage('waiting'); }}>
      <p>Welcome! Your WhatsApp number is confirmed. What should we call you?</p>
      <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>
      <button className="cta">Finish</button>
    </form>
  );
  return (
    <div role="status" aria-live="polite">
      <p><b>Waiting for your WhatsApp message…</b></p>
      <p className="muted">Press send on the message in WhatsApp, then come back here. This page signs you in by itself.</p>
      <a className="ghost" href={link} target="_blank" rel="noopener noreferrer">Open WhatsApp again</a>{' '}
      <button className="ghost" onClick={() => setStage('idle')}>Cancel</button>
    </div>
  );
}

function CodeLogin() {
  const { setUser } = useAuth(); const nav = useNavigate();
  const from = useLocation().state?.from;
  const [phone, setPhone] = useState(''), [name, setName] = useState(''), [code, setCode] = useState('');
  const [sent, setSent] = useState(false), [hint, setHint] = useState(''), [err, setErr] = useState('');
  const run = (fn) => async (e) => { e.preventDefault(); setErr(''); try { await fn(); } catch (x) { setErr(x.message); } };

  const request = run(async () => {
    const d = await api('/auth/otp/request', { method: 'POST', body: { phone } });
    setSent(true); if (d.devCode) setHint(`Development mode: your code is ${d.devCode}`);
  });
  const verify = run(async () => {
    const d = await api('/auth/otp/verify', { method: 'POST', body: { phone, code, name: name || undefined } });
    setUser(d.user); nav(from?.pathname || '/book', { state: from?.state });
  });

  return !sent ? (
    <form onSubmit={request}>
      <label>Phone number (with country code)<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="+44 7700 900123" required /></label>
      <label>Your name (first visit only)<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
      <p className="err" role="alert">{err}</p>
      <button className="cta">Send me a code</button>
    </form>
  ) : (
    <form onSubmit={verify}>
      <p>We sent a 6-digit code to {phone}.</p>
      {hint && <p className="note">{hint}</p>}
      <label>Code<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} autoComplete="one-time-code" required /></label>
      <p className="err" role="alert">{err}</p>
      <button className="cta">Sign in</button>
      <button type="button" className="ghost" onClick={() => setSent(false)}>Use a different number</button>
    </form>
  );
}

function StaffLogin() {
  const { setUser } = useAuth(); const nav = useNavigate();
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { const d = await api('/auth/staff/login', { method: 'POST', body: { email, password } }); setUser(d.user); nav('/staff'); }
    catch (x) { setErr(x.message); }
  };
  return (
    <form onSubmit={submit}>
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
      <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
      <p className="err" role="alert">{err}</p>
      <button className="cta">Sign in</button>
    </form>
  );
}
