import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { socket } from '../socket.js';
import { useQueue } from '../useQueue.js';
import { fmt, iso, longDate, tok } from '../util.js';

const remindMsg = (a) =>
  `Hi ${(a.customerName || '').split(' ')[0]}, a reminder from Maison Lilac: ${a.serviceName} on ${longDate(a.date)} at ${fmt(a.start)} (token ${tok(a.token)}).` +
  (a.depositAmount && !a.depositPaid ? ` A deposit of $${a.depositAmount} is still due.` : '') + ' Reply to change or cancel.';

export default function Staff() {
  const q = useQueue();
  const [day, setDay] = useState(iso()), [list, setList] = useState([]), [err, setErr] = useState('');

  const load = useCallback(() => api(`/appointments?date=${day}`).then(setList).catch((e) => setErr(e.message)), [day]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { socket.on('appointments', load); return () => socket.off('appointments', load); }, [load]);

  const act = (fn) => async () => { setErr(''); try { await fn(); } catch (e) { setErr(e.message); } };
  const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); setDay(iso(d)); };

  return (
    <>
      <div className="board" role="status" aria-live="polite">
        <small>Now serving</small><strong>{q.serving ? tok(q.serving) : '—'}</strong>
        <small>{q.waiting ? `${q.waiting} waiting · about ${q.etaMin} min` : 'No one waiting'}</small>
        <div className="btns">
          <button className="ghost light" onClick={act(() => api('/queue/prev', { method: 'POST' }))}>Previous</button>
          <button className="cta" onClick={act(() => api('/queue/next', { method: 'POST' }))}>Call next</button>
        </div>
      </div>
      <p className="err" role="alert">{err}</p>
      <p className="muted">Tip: open Messages and turn on phone alerts to hear about new bookings and cancellations.</p>

      <section className="step">
        <div className="toolbar">
          <h2>Appointments</h2>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value || iso())} aria-label="Choose day" />
          <button className="ghost sm" onClick={tomorrow}>Tomorrow</button>
        </div>
        {list.length === 0 && <p className="muted">No appointments on {longDate(day)}.</p>}
        {list.map((a) => {
          const digits = (a.phone || '').replace(/\D/g, ''), m = encodeURIComponent(remindMsg(a));
          return (
            <div className="appt" key={a._id}>
              <div className="t">{fmt(a.start)}</div>
              <div className="m">
                <strong>{a.customerName}</strong> · {a.serviceName}
                <span>{tok(a.token)} · {a.stylistName} · until {fmt(a.start + a.dur)} · {a.phone || a.email || 'no contact'} · {a.status}
                  {a.depositAmount > 0 ? (a.depositPaid ? ' · Deposit paid' : ` · Deposit $${a.depositAmount} due`) : ''}</span>
                <span className="acts">
                  {digits && <a className="ghost sm" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${digits}?text=${m}`}>WhatsApp reminder</a>}
                  {digits && <a className="ghost sm" href={`sms:${a.phone}?&body=${m}`}>SMS reminder</a>}
                  {a.depositAmount > 0 && !a.depositPaid && <button className="ghost sm" onClick={act(async () => { await api(`/appointments/${a._id}/deposit-paid`, { method: 'PATCH' }); })}>Mark deposit paid</button>}
                </span>
              </div>
              <button className="ghost" onClick={act(async () => { if (confirm('Cancel this appointment?')) await api(`/appointments/${a._id}/cancel`, { method: 'PATCH' }); })}>Cancel</button>
            </div>
          );
        })}
      </section>
    </>
  );
}
