import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useQueue } from '../useQueue.js';
import { useClock } from '../useClock.js';
import { dayList, fmt, iso, tok } from '../util.js';
import { SITE } from '../site.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const categoryOf = (s) => /colou?r|highlight/i.test(s.name) ? 'Colour' : /cut|trim/i.test(s.name) ? 'Cuts' : 'Care';
const CATEGORIES = ['All', 'Cuts', 'Colour', 'Care'];
const initials = (n) => n.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const rangeText = (sessions) => sessions.map(([a, b]) => `${fmt(a)} – ${fmt(b)}`).join(', ');

// All times come from the salon's own clock on the server, not the visitor's device.
function dayStatus(c) {
  if (!c) return 'Checking hours…';
  if (c.closed.includes(c.dow)) return 'Closed today';
  const cur = c.sessions.find(([a, b]) => c.minutes >= a && c.minutes < b);
  if (cur) return `Open now · until ${fmt(cur[1])}`;
  const next = c.sessions.find(([a]) => a > c.minutes);
  return next ? `Closed now · opens at ${fmt(next[0])}` : 'Closed for today';
}
const isOpen = (c) => !!c && !c.closed.includes(c.dow) && c.sessions.some(([a, b]) => c.minutes >= a && c.minutes < b);

function whenLabel(date, today) {
  if (date === today) return 'Today';
  if (today && date === iso(dayList(2, today)[1])) return 'Tomorrow';
  return new Date(date + 'T00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}
// Looks up to a week ahead for the first open time for a service and stylist.
async function nextFree(svc, today, stylist = 'any') {
  for (let i = 0; i < 8; i++) {
    const d = dayList(8, today)[i];
    try {
      const slots = await api(`/appointments/availability?date=${iso(d)}&serviceId=${svc._id}&stylistId=${stylist}`);
      const f = slots.find((x) => x.ok);
      if (f) return { date: iso(d), start: f.start };
    } catch { /* closed day or error: try the next day */ }
  }
  return null;
}

// Today's opening sessions on a line, with a marker for the current time.
function DayBar({ clock }) {
  if (!clock || clock.closed.includes(clock.dow)) return null;
  const start = clock.sessions[0][0], end = clock.sessions[clock.sessions.length - 1][1], span = end - start;
  const pct = (m) => ((m - start) / span) * 100;
  return (
    <div className="daybar" role="img" aria-label={`Today’s opening hours: ${rangeText(clock.sessions)}`}>
      <div className="track">
        {clock.sessions.map(([a, b]) => <span key={a} className="seg" style={{ left: pct(a) + '%', width: pct(b) - pct(a) + '%' }} />)}
        {clock.minutes >= start && clock.minutes <= end && <span className="now" style={{ left: pct(clock.minutes) + '%' }} />}
      </div>
      <div className="ticks">{clock.sessions.map(([a, b]) => <span key={a}>{fmt(a)}–{fmt(b)}</span>)}</div>
    </div>
  );
}

export default function Home() {
  const q = useQueue();
  const nav = useNavigate();
  const clock = useClock();
  const [services, setServices] = useState([]), [stylists, setStylists] = useState([]), [loaded, setLoaded] = useState(false);
  const [cat, setCat] = useState('All'), [sel, setSel] = useState(null), [pick, setPick] = useState('any'), [free, setFree] = useState(undefined);

  useEffect(() => {
    api('/services').then(setServices).catch(() => {}).finally(() => setLoaded(true));
    api('/stylists').then(setStylists).catch(() => {});
  }, []);
  useEffect(() => {
    if (!sel || !clock) return;
    let live = true; setFree(undefined);
    nextFree(sel, clock.today, pick).then((r) => live && setFree(r));
    return () => { live = false; };
  }, [sel, pick, clock?.today]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = services.filter((s) => cat === 'All' || categoryOf(s) === cat);
  const book = (state) => nav('/book', { state });
  const todayIdx = clock ? clock.dow : new Date().getDay();
  const busy = q.waiting === 0 ? 'Quiet right now' : q.waiting <= 2 ? 'A short queue' : 'Busy right now';
  const closedNames = clock?.closed?.length ? clock.closed.map((d) => DAY_NAMES[d]).join(' and ') : '';
  const hasContact = SITE.phone || SITE.whatsapp || SITE.address || SITE.instagram;

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className={'pill ' + (isOpen(clock) ? 'ok' : 'off')}>{dayStatus(clock)}</span>
          <h2 className="hero-title">Know exactly when you’re up.</h2>
          <p>Book a time with your stylist, get a queue token, and watch the line move from your phone.</p>
          <div className="hero-actions">
            <button className="cta wide-btn" onClick={() => book()}>Book an appointment</button>
            <button className="ghost light" onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}>See services</button>
          </div>
          <DayBar clock={clock} />
        </div>
        <div className="live" role="status" aria-live="polite">
          <div className="live-top"><span className="dot" aria-hidden="true" /> Live in the salon · <b className="busy">{busy}</b></div>
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
            {!loaded && [0, 1, 2, 3].map((i) => <div key={i} className="svc skeleton" aria-hidden="true" />)}
            {shown.map((s) => (
              <button key={s._id} className="svc" aria-pressed={sel?._id === s._id} onClick={() => setSel(s)}>
                <span className="svc-name">{s.name}{s.deposit > 0 && <span className="tag">Deposit</span>}</span>
                <span className="svc-meta">{s.minutes} min</span>
                <span className="svc-price">${s.price}</span>
              </button>
            ))}
            {loaded && shown.length === 0 && <p className="muted">{services.length ? 'No services in this group.' : 'Services will appear here soon.'}</p>}
          </div>
          <aside className="detail" aria-live="polite">
            {!sel ? (
              <p className="muted">Pick a service to see how long it takes, what it costs and the next free time.</p>
            ) : (
              <>
                <h3>{sel.name}</h3>
                <p className="label">Choose a stylist</p>
                <div className="chips" role="group" aria-label="Stylist">
                  {[{ _id: 'any', name: 'Anyone' }, ...stylists].map((s) => (
                    <button key={s._id} aria-pressed={pick === s._id} onClick={() => setPick(s._id)}>{s.name}</button>
                  ))}
                </div>
                <dl>
                  <div><dt>Duration</dt><dd>{sel.minutes} min</dd></div>
                  <div><dt>Price</dt><dd>${sel.price}</dd></div>
                  <div><dt>Deposit</dt><dd>{sel.deposit ? `$${sel.deposit} to confirm` : 'None'}</dd></div>
                  <div><dt>Next free</dt><dd>{free === undefined ? 'Checking…' : free ? `${whenLabel(free.date, clock?.today)} at ${fmt(free.start)}` : 'Nothing this week'}</dd></div>
                </dl>
                <button className="cta" onClick={() => book({ serviceId: sel._id, stylistId: pick })}>Book {sel.name.toLowerCase()}</button>
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
          <li><b>Get alerts</b><span>Reminders and “you’re next” messages arrive in the app and on your phone.</span></li>
        </ol>
      </section>

      <section className="block">
        <h2>Questions</h2>
        <div className="faq">
          <details><summary>How does the queue token work?</summary>
            <p>Every booking gets a number for its day, such as T-007. When the salon calls your number, you’re up. The Now serving board and your Messages show how many are ahead of you and the estimated wait.</p></details>
          <details><summary>Do I need to pay a deposit?</summary>
            <p>Longer services such as colour and highlights need a deposit to confirm the booking. The amount is shown on the service and again before you confirm. You pay it at the counter or by bank transfer, using your token as the reference.</p></details>
          <details><summary>Can I change or cancel my booking?</summary>
            <p>You can cancel from Your bookings on the Book page. To move to a different time, cancel and book a new one.</p></details>
          <details><summary>Will I get a reminder?</summary>
            <p>Yes. You get a message in the app the day before and about two hours before. Turn on phone alerts in Messages to get them even when the site is closed.</p></details>
          <details><summary>When are you open?</summary>
            <p>{clock ? `${closedNames ? `Closed on ${closedNames}. Otherwise open` : 'Open every day'}: ${rangeText(clock.sessions)}. ` : ''}A service has to fit inside one opening session, so a long service can’t start just before a break.</p></details>
        </div>
      </section>

      <section className="block hours">
        <h2>Opening hours</h2>
        <table>
          <tbody>
            {ORDER.map((d) => (
              <tr key={d} className={d === todayIdx ? 'today' : ''}>
                <th scope="row">{DAY_NAMES[d]}</th>
                <td>{!clock ? '—' : clock.closed.includes(d) ? 'Closed' : rangeText(clock.sessions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {hasContact && (
        <section className="block">
          <h2>Find us</h2>
          {SITE.address && <p>{SITE.address}</p>}
          <div className="contact">
            {SITE.address && <a className="ghost" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SITE.address)}`}>Open in maps</a>}
            {SITE.phone && <a className="ghost" href={`tel:${SITE.phone}`}>Call us</a>}
            {SITE.whatsapp && <a className="ghost" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${SITE.whatsapp.replace(/\D/g, '')}`}>WhatsApp us</a>}
            {SITE.instagram && <a className="ghost" target="_blank" rel="noopener noreferrer" href={SITE.instagram}>Instagram</a>}
          </div>
        </section>
      )}

      <section className="band">
        <h2>Ready for a fresh look?</h2>
        <button className="cta wide-btn" onClick={() => book()}>Book an appointment</button>
      </section>

    </>
  );
}
