import { useEffect, useState } from 'react';
import { api } from './api.js';

// The salon's own clock from the server: { today: 'YYYY-MM-DD', minutes, dow }.
// Refreshes every minute, so past times drop off the list without a page reload.
export function useClock() {
  const [c, setC] = useState(null);
  useEffect(() => {
    let live = true;
    const load = () => api('/time').then((d) => live && setC(d)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { live = false; clearInterval(t); };
  }, []);
  return c;
}
