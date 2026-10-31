import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { socket } from '../socket.js';
import { useQueue } from '../useQueue.js';
import { useClock } from '../useClock.js';
import { dayList, fmt, iso, longDate, tok } from '../util.js';


export default function Book() {
  const q = useQueue();
  const clock = useClock();
  const pre = useLocation().state || {};        // set by the home page: { serviceId, stylistId }
  const [services, setServices] = useState([]), [stylists, setStylists] = useState([]);
  const [svc, setSvc] = useState(null), [sty, setSty] = useState(pre.stylistId || 'any'), [date, setDate] = useState(null);
  const [slots, setSlots] = useState([]), [time, setTime] = useState(null);
  const [mine, setMine] = useState([]), [done, setDone] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/services').then((list) => { setServices(list); const s = list.find((x) => x._id === pre.serviceId); if (s) setSvc(s); });
    api('/stylists').then(setStylists);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (svc && !date && clock) setDate(iso(dayList(14, clock.today).find((d) => !clock.closed.includes(d.getDay())))); }, [svc, date, clock]);

  const loadMine = useCallback(() => api('/appointments/mine').then(setMine).catch(() => {}), []);
  const loadSlots = useCallback(() => {
    if (!svc || !date) return setSlots([]);
    api(`/appointments/availability?date=${date}&serviceId=${svc._id}&stylistId=${sty}`).then(setSlots).catch((e) => setErr(e.message));
  }, [svc, sty, date]);

  useEffect(() => { loadMine(); }, [loadMine, q.serving, q.waiting]);
  useEffect(() => { loadSlots(); }, [loadSlots, clock?.minutes]);   // re-check every minute so past times disappear
  useEffect(() => { socket.on('slots', loadSlots); return () => socket.off('slots', loadSlots); }, [loadSlots]);

  const book = async () => {
    setBusy(true); setErr('');
    try {
      const a = await api('/appointments', { method: 'POST', body: { date, start: time, serviceId: svc._id, stylistId: sty } });
      setDone(a); setTime(null); loadMine();
    } catch (e) { setErr(e.message); setTime(null); loadSlots(); }
    finally { setBusy(false); }
  };
  const cancel = async (id) => { if (confirm('Cancel this appointment?')) { await api(`/appointments/${id}/cancel`, { method: 'PATCH' }); loadMine(); loadSlots(); } };

  if (done) return (
    <section className="step done">
      <h2>You’re booked</h2>
      <p className="label">Your token for {longDate(done.date)}</p>
      <div className="token">{tok(done.token)}</div>
      <p>{done.serviceName} with {done.stylistName}<br /><strong>{longDate(done.date)} at {fmt(done.start)}</strong></p>
      {done.depositAmount > 0 && <p><strong>Deposit due: ${done.depositAmount}</strong><br /><span className="muted">Pay at the counter or by bank transfer, using your token as the reference.</span></p>}
      <button className="ghost" onClick={() => { setDone(null); setSvc(null); setDate(null); }}>Book another appointment</button>
    </section>
  );

  const anyOpen = slots.some((s) => s.ok);
  const styName = sty === 'any' ? 'first available stylist' : stylists.find((s) => s._id === sty)?.name;
  return (
    <>
      <div className="board" role="status" aria-live="polite">
        <small>Now serving</small><strong>{q.serving ? tok(q.serving) : '—'}</strong>
        <small>{q.waiting ? `${q.waiting} waiting · about ${q.etaMin} min for a new booking` : 'No one waiting'}</small>
      </div>

      {mine.length > 0 && (
        <section className="step"><h2>Your bookings</h2>
          {mine.map((a) => (
            <div className="mine" key={a._id}>
              <b>{tok(a.token)}</b>
              <span>{a.serviceName} · {longDate(a.date)} at {fmt(a.start)}
                {a.status === 'serving' ? ' · Your turn' : a.ahead === 0 ? ' · You’re next' : a.ahead > 0 ? ` · ${a.ahead} ahead · about ${a.etaMin} min` : ''}
                {a.depositAmount > 0 ? (a.depositPaid ? ' · Deposit paid' : ` · Deposit $${a.depositAmount} due`) : ''}</span>
              <button className="ghost sm" onClick={() => cancel(a._id)}>Cancel</button>
            </div>
          ))}
        </section>
      )}

      <section className="step"><h2><span className="num">1</span>What are you booking?</h2>
        <div className="grid">{services.map((s) => (
          <button key={s._id} className="opt" aria-pressed={svc?._id === s._id} onClick={() => { setSvc(s); setTime(null); }}>
            <b>{s.name}</b><span>{s.minutes} min · ${s.price}{s.deposit ? ` · $${s.deposit} deposit` : ''}</span>
          </button>))}</div>
      </section>

      <section className={'step' + (svc ? '' : ' off')}><h2><span className="num">2</span>Who would you like?</h2>
        <div className="grid">
          {[{ _id: 'any', name: 'No preference', title: 'First available' }, ...stylists].map((s) => (
            <button key={s._id} className="opt" aria-pressed={sty === s._id} onClick={() => { setSty(s._id); setTime(null); }}>
              <b>{s.name}</b><span>{s.title}</span>
            </button>))}
        </div>
      </section>

      <section className={'step' + (svc ? '' : ' off')}><h2><span className="num">3</span>Pick a day and time</h2>
        <div className="days">{dayList(14, clock?.today).map((d) => {
          const k = iso(d), sun = (clock?.closed || []).includes(d.getDay());
          return (
            <button key={k} className="day" disabled={sun} aria-pressed={date === k} onClick={() => { setDate(k); setTime(null); }}>
              <small>{d.toLocaleDateString('en-GB', { weekday: 'short' })}</small><strong>{d.getDate()}</strong><small>{d.toLocaleDateString('en-GB', { month: 'short' })}</small>
            </button>);
        })}</div>
        {svc && date
          ? (anyOpen
            ? <div>{[['Morning', 0, 720], ['Afternoon', 720, 1080], ['Evening', 1080, 1440]].map(([label, a, b]) => {
              const g = slots.filter((s) => s.start >= a && s.start < b);
              return g.length ? <div className="sgroup" key={label}><p className="label">{label}</p><div className="slots">{g.map((s) => <button key={s.start} className="slot" disabled={!s.ok} aria-pressed={time === s.start} onClick={() => setTime(s.start)}>{fmt(s.start)}</button>)}</div></div> : null;
            })}</div>
            : <p className="muted">No times left on this day. Try another day or stylist.</p>)
          : <p className="muted">Choose a service, then a day to see open times.</p>}
      </section>

      <div className="confirm">
        <p className={'sum' + (time ? '' : ' muted')}>
          {time ? <><b>{svc.name}</b> with {styName}<br />{longDate(date)} at {fmt(time)} · ${svc.price}{svc.deposit ? ` · $${svc.deposit} deposit` : ''}</> : 'Choose a service, a stylist and a time to continue.'}
        </p>
        <p className="err" role="alert">{err}</p>
        <button className="cta" disabled={!time || busy} onClick={book}>{busy ? 'Booking…' : 'Confirm booking'}</button>
      </div>
    </>
  );
}
