import { useState } from 'react';
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

function CustomerLogin() {
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
