// Opening hours and rules. Times are minutes after midnight.
// Opening sessions every day, as [from, to] in minutes after midnight. Edit these to change the hours.
// Now: 09:00-12:00, 14:00-18:00 and 20:00-22:00.
export const SESSIONS = [[9 * 60, 12 * 60], [14 * 60, 18 * 60], [20 * 60, 22 * 60]];
export const CLOSED_DAYS = [];   // days of the week the salon is closed: 0 = Sunday ... 6 = Saturday, e.g. [0]
export const OPEN = SESSIONS[0][0];
export const CLOSE = SESSIONS[SESSIONS.length - 1][1];
// A service fits only if it starts and finishes inside one session.
export const fitsHours = (start, dur) => SESSIONS.some(([a, b]) => start >= a && start + dur <= b);
export const STEP = 30;          // booking block size in minutes
export const DEP_MIN = 120;      // services this long (minutes) or longer need a deposit
export const DEP_PCT = 0.3;      // deposit as a share of the price
export const MAX_DAYS_AHEAD = 30;

// The salon's timezone. The server (for example on Render) usually runs on UTC, so "today",
// "now" and opening hours must be worked out in the salon's own timezone, not the server's.
// Set SALON_TZ in the environment, for example SALON_TZ=Europe/London
let tz = process.env.SALON_TZ || process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
let clock;
try { clock = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
catch { console.warn(`Unknown timezone "${tz}", using UTC. Set SALON_TZ to a name like Europe/London.`); tz = 'UTC'; clock = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
if (tz === 'UTC' && !process.env.SALON_TZ && !process.env.TZ) console.warn('SALON_TZ is not set, so the salon clock is UTC. Opening hours and past-time checks will be wrong until you set it.');
export const SALON_TZ = tz;
const parts = (d) => Object.fromEntries(clock.formatToParts(d).map((p) => [p.type, p.value]));
export const isoDate = (d = new Date()) => { const p = parts(d); return `${p.year}-${p.month}-${p.day}`; };
export const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + 'T00:00:00').getTime());
export const isSunday = (s) => new Date(s + 'T00:00:00').getDay() === 0;
export const nowMinutes = (d = new Date()) => { const p = parts(d); return Number(p.hour) * 60 + Number(p.minute); };
export const daysFromToday = (s) => Math.round((new Date(s + 'T00:00:00') - new Date(isoDate() + 'T00:00:00')) / 864e5);
