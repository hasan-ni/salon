import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { disablePush, enablePush, pushState } from '../push.js';

const ROLE = { customer: 'Customer', staff: 'Staff', admin: 'Owner' };
const initials = (n = '') => n.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

// Account tab: who is signed in, install the app, phone alerts, sign out.
export default function Account() {
  const { user, logout } = useAuth();
  const [evt, setEvt] = useState(null), [ps, setPs] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;

  useEffect(() => {
    const h = (e) => { e.preventDefault(); setEvt(e); };   // Chrome offers a one-tap install
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  useEffect(() => { if (user) pushState().then(setPs).catch(() => setPs('unsupported')); }, [user]);

  const install = async () => { evt.prompt(); await evt.userChoice; setEvt(null); };
  const togglePush = async () => {
    setBusy(true); setErr('');
    try { if (ps === 'on') { await disablePush(); setPs('off'); } else { await enablePush(); setPs('on'); } }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <>
      <section className="step profile">
        {user ? (
          <>
            <div className="avatar big-avatar" aria-hidden="true">{initials(user.name)}</div>
            <div><h2>{user.name}</h2><p className="muted">{ROLE[user.role] || user.role}</p></div>
          </>
        ) : (
          <div><h2>Welcome</h2><p className="muted">Sign in to book, change appointments and get messages.</p>
            <Link className="cta wide-btn" to="/login" style={{ display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}>Sign in</Link></div>
        )}
      </section>

      <section className="step">
        <h2>Install the app</h2>
        {standalone ? <p className="muted">You’re using the installed app.</p>
          : evt ? <><p className="muted">Add Maison Lilac to your home screen. It opens full screen like any other app.</p><button className="cta" onClick={install}>Install app</button></>
          : <p className="muted">Open your browser’s menu and choose <b>Install app</b> or <b>Add to Home screen</b>. On iPhone, tap Share, then <b>Add to Home Screen</b>.</p>}
      </section>

      {user && (
        <section className="step">
          <h2>Phone alerts</h2>
          {ps === 'off' && <><p className="muted">Get reminders and “you’re next” alerts even when the app is closed.</p><button className="cta" disabled={busy} onClick={togglePush}>Turn on phone alerts</button></>}
          {ps === 'on' && <><p className="muted">Phone alerts are on for this device.</p><button className="ghost" disabled={busy} onClick={togglePush}>Turn off</button></>}
          {ps === 'denied' && <p className="muted">Alerts are blocked. Allow notifications for this site in your browser settings.</p>}
          {ps === 'ios' && <p className="muted">On iPhone, add the app to your Home Screen first, then open it from there and turn alerts on.</p>}
          {ps === 'notset' && <p className="muted">Phone alerts aren’t set up yet.</p>}
          {ps === 'unsupported' && <p className="muted">This browser can’t show phone alerts. Messages still appear in the app.</p>}
          {err && <p className="err" role="alert">{err}</p>}
        </section>
      )}

      {user && <button className="ghost signout" onClick={logout}>Sign out</button>}
    </>
  );
}
