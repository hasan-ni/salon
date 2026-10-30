// Opening hours and rules. Times are minutes after midnight.
export const OPEN = 9 * 60;      // 09:00
export const CLOSE = 18 * 60;    // 18:00
export const STEP = 30;          // booking block size in minutes
export const DEP_MIN = 120;      // services this long (minutes) or longer need a deposit
export const DEP_PCT = 0.3;      // deposit as a share of the price
export const MAX_DAYS_AHEAD = 30;

const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + 'T00:00:00').getTime());
export const isSunday = (s) => new Date(s + 'T00:00:00').getDay() === 0;
export const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const daysFromToday = (s) => Math.round((new Date(s + 'T00:00:00') - new Date(isoDate() + 'T00:00:00')) / 864e5);
