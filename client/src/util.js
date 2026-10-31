const pad = (n) => String(n).padStart(2, '0');
export const fmt = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const tok = (n) => 'T-' + String(n || 0).padStart(3, '0');
export const iso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const longDate = (s) => new Date(s + 'T00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
// n calendar days starting from `start` (YYYY-MM-DD, the salon's today). Falls back to this device's today.
export const dayList = (n = 14, start) => { const [y, m, d] = (start || iso()).split('-').map(Number); return Array.from({ length: n }, (_, i) => new Date(y, m - 1, d + i)); };
