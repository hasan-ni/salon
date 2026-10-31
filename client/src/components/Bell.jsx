import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { socket } from '../socket.js';
import { chime, setSound, soundOn, unlockAudio } from '../chime.js';
import { disablePush, enablePush, pushState } from '../push.js';

// "Messages" button with an unread count, a list of in-app messages, and a pop-up for new ones.
export default function Bell() {
  const [items, setItems] = useState([]), [unread, setUnread] = useState(0), [open, setOpen] = useState(false), [toast, setToast] = useState(null);
  const [ps, setPs] = useState(null), [psErr, setPsErr] = useState(''), [psBusy, setPsBusy] = useState(false);
  const [snd, setSnd] = useState(soundOn());
  const pushOn = useRef(false);   // when phone alerts are on, the phone plays its own sound
  const box = useRef(null);

  const load = useCallback(() => api('/notifications').then((d) => { setItems(d.items); setUnread(d.unread); }).catch(() => {}), []);

  useEffect(() => {
    load();
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    pushState().then((s) => { pushOn.current = s === 'on'; }).catch(() => {});
    const onNew = (n) => {
      if (soundOn() && !pushOn.current) chime(n.kind);
      setItems((l) => [n, ...l].slice(0, 30));
      setUnread((u) => u + 1);
      setToast(n);
      setTimeout(() => setToast((t) => (t && t._id === n._id ? null : t)), 7000);
    };
    socket.on('notification', onNew);
    socket.on('connect', load);          // catch up on anything missed while offline
    return () => { socket.off('notification', onNew); socket.off('connect', load); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) pushState().then(setPs).catch(() => setPs('unsupported'));
    if (next && unread) { setUnread(0); api('/notifications/read', { method: 'POST', body: {} }).catch(() => {}); }
  };
  const when = (d) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bell" ref={box}>
      <button className="ghost sm" onClick={toggle} aria-expanded={open} aria-label={`Messages${unread ? `, ${unread} unread` : ''}`}>
        Messages{unread > 0 && <span className="badge">{unread}</span>}
      </button>
      {open && (
        <div className="panel" role="region" aria-label="Messages">
          <div className="alerts">
            <span>Sound for new messages: <button className="link" onClick={() => { const n = !snd; setSnd(n); setSound(n); if (n) { unlockAudio(); chime('message'); } }}>{snd ? 'On' : 'Off'}</button></span>
            {ps === 'off' && <button className="ghost sm" disabled={psBusy} onClick={async () => { setPsBusy(true); setPsErr(''); try { await enablePush(); setPs('on'); pushOn.current = true; } catch (e) { setPsErr(e.message); } setPsBusy(false); }}>Turn on phone alerts</button>}
            {ps === 'on' && <span>Phone alerts are on. <button className="link" onClick={async () => { await disablePush(); setPs('off'); pushOn.current = false; }}>Turn off</button></span>}
            {ps === 'denied' && <span className="muted">Alerts are blocked. Allow notifications for this site in your browser settings to turn them on.</span>}
            {ps === 'ios' && <span className="muted">On iPhone: tap Share, then Add to Home Screen, then open Maison Lilac from your home screen and turn on alerts here.</span>}
            {ps === 'unsupported' && <span className="muted">This browser can’t show phone alerts. Messages will still appear here.</span>}
            {psErr && <span className="err" role="alert">{psErr}</span>}
          </div>
          {items.length === 0 && <p className="muted">No messages yet. New alerts will appear here.</p>}
          {items.map((n) => (
            <div key={n._id} className={'msg' + (n.read ? '' : ' new')}>
              <b>{n.title}</b><p>{n.body}</p><small>{when(n.createdAt)}</small>
            </div>
          ))}
        </div>
      )}
      {toast && <div className="toast" role="status" aria-live="polite"><b>{toast.title}</b><span>{toast.body}</span></div>}
    </div>
  );
}
