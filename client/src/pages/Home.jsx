import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useQueue } from '../useQueue.js';
import { useClock } from '../useClock.js';
import { dayList, fmt, iso, tok } from '../util.js';

// Opening hours, by day of week (0 = Sunday). Keep in step with OPEN and CLOSE in server/src/config.js.
const HOURS = [null, [540, 1080], [540, 1080], [540, 1080], [540, 1080], [540, 1080], [540, 1080]];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

const categoryOf = (s) => /colou?r|highlight/i.test(s.name) ? 'Colour' : /cut|trim/i.test(s.name) ? 'Cuts' : 'Care';
const CATEGORIES = ['All', 'Cuts', 'Colour', 'Care'];
const initials = (n) => n.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

// Uses the salon's own clock from the server, not the visitor's device time.
function isOpen(c) {
  if (!c) return false;
  const h = HOURS[c.dow];
  return !!h && c.minutes >= h[0] && c.minutes < h[1];
}
function whenLabel(date, today) {
  if (date === today) return 'Today';
  if (today && date === iso(dayList(2, today)[1])) return 'Tomorrow';
  return new Date(date + 'T00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}
// Looks up to a week ahead for the first open time for a service.
async function nextFree(svc, today, stylist = 'any') {
  for (let i = 0; i < 8; i++) {
    const d = dayList(8, today)[i];
    if (d.getDay() === 0) continue;
    try {
      const slots = await api(`/appointments/availability?date=${iso(d)}&serviceId=${svc._id}&stylistId=${stylist}`);
      const f = slots.find((x) => x.ok);
      if (f) return { date: iso(d), start: f.start };
    } catch { /* skip this day */ }
  }
  return null;
}

export default function Home() {
  const q = useQueue();
  const nav = useNavigate();
  const [services, setServices] = useState([]), [stylists, setStylists] = useState([]);
  const [cat, setCat] = useState('All'), [sel, setSel] = useState(null), [free, setFree] = useState(undefined);
  const clock = useClock();
  const open = isOpen(clock);

  useEffect(() => { api('/services').then(setServices).catch(() => {}); api('/stylists').then(setStylists).catch(() => {}); }, []);
  useEffect(() => {
    if (!sel || !clock) return;
    let live = true; setFree(undefined);
    nextFree(sel, clock.today).then((r) => live && setFree(r));
    return () => { live = false; };
  }, [sel, clock?.today]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = services.filter((s) => cat === 'All' || categoryOf(s) === cat);
  const book = (state) => nav('/book', { state });
  const todayIdx = clock ? clock.dow : new Date().getDay();

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className={'pill ' + (open ? 'ok' : 'off')}>{open ? 'Open now' : 'Closed right now'}</span>
          <h2 className="hero-title">Know exactly when you’re up.</h2>
          <p>Book a time with your stylist, get a queue token, and watch the line move from your phone.</p>
          <div className="hero-actions">
            <button className="cta wide-btn" onClick={() => book()}>Book an appointment</button>
            <button className="ghost light" onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}>See services</button>
          </div>
        </div>
        <div className="live" role="status" aria-live="polite">
          <div className="live-top"><span className="dot" aria-hidden="true" /> Live in the salon</div>
          <div className="live-label">Now serving</div>
          <div className="live-num" key={q.serving}>{q.serving ? tok(q.serving) : '—'}</div>
          <div className="live-stats">
            <div><b>{q.waiting}</b><span>waiting</span></div>
            <div><b>{q.waiting ? `${q.etaMin} min` : 'None'}</b><span>wait for a new booking</span></div>
          </div>
          {q.next.length > 0 && <div className="live-next"><span>Next</span>{q.next.slice(0, 3).map((t) => <b key={t}>{tok(t)}</b>)}</div>}
        </div>
      </section>

      <section id="services" className="block">
        <h2>Services</h2>
        <div className="chips" role="tablist" aria-label="Service type">
          {CATEGORIES.map((c) => <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        <div className="explorer">
          <div className="svc-list">
            {shown.map((s) => (
              <button key={s._id} className="svc" aria-pressed={sel?._id === s._id} onClick={() => setSel(s)}>
                <span className="svc-name">{s.name}</span>
                <span className="svc-meta">{s.minutes} min</span>
                <span className="svc-price">${s.price}</span>
              </button>
            ))}
            {services.length > 0 && shown.length === 0 && <p className="muted">No services in this group.</p>}
          </div>
          <aside className="detail" aria-live="polite">
            {!sel ? (
              <p className="muted">Pick a service to see how long it takes, what it costs and the next free time.</p>
            ) : (
              <>
                <h3>{sel.name}</h3>
                <dl>
                  <div><dt>Duration</dt><dd>{sel.minutes} min</dd></div>
                  <div><dt>Price</dt><dd>${sel.price}</dd></div>
                  <div><dt>Deposit</dt><dd>{sel.deposit ? `$${sel.deposit} to confirm` : 'None'}</dd></div>
                  <div><dt>Next free</dt><dd>{free === undefined ? 'Checking…' : free ? `${whenLabel(free.date, clock?.today)} at ${fmt(free.start)}` : 'Nothing this week'}</dd></div>
                </dl>
                <button className="cta" onClick={() => book({ serviceId: sel._id })}>Book {sel.name.toLowerCase()}</button>
              </>
            )}
          </aside>
        </div>
      </section>

      <section className="block">
        <h2>Our stylists</h2>
        <div className="team">
          {stylists.map((s) => (
            <div className="stylist" key={s._id}>
              <div className="avatar" aria-hidden="true">{initials(s.name)}</div>
              <div><b>{s.name}</b><span>{s.title}</span></div>
              <button className="ghost sm" onClick={() => book({ stylistId: s._id, serviceId: sel?._id })}>Book with {s.name}</button>
            </div>
          ))}
        </div>
      </section>

      <section className="block">
        <h2>How it works</h2>
        <ol className="steps">
          <li><b>Choose</b><span>Pick a service, a stylist and a time that suits you.</span></li>
          <li><b>Get your token</b><span>Your booking gets a number for the day, such as T-007.</span></li>
          <li><b>Watch the queue</b><span>See how many are ahead and the estimated wait, live.</span></li>
        </ol>
      </section>

      <section className="block hours">
        <h2>Opening hours</h2>
        <table>
          <tbody>
            {ORDER.map((d) => (
              <tr key={d} className={d === todayIdx ? 'today' : ''}>
                <th scope="row">{DAY_NAMES[d]}</th>
                <td>{HOURS[d] ? `${fmt(HOURS[d][0])} – ${fmt(HOURS[d][1])}` : 'Closed'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="band">
        <h2>Ready for a fresh look?</h2>
        <button className="cta wide-btn" onClick={() => book()}>Book an appointment</button>
      </section>
    </>
  );
}
