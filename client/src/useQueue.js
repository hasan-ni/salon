import { useEffect, useState } from 'react';
import { api } from './api.js';
import { socket } from './socket.js';

// Live queue snapshot: loaded once, then pushed by the server whenever it changes.
export function useQueue() {
  const [q, setQ] = useState({ serving: 0, waiting: 0, etaMin: 0, next: [] });
  useEffect(() => {
    api('/queue/today').then(setQ).catch(() => {});
    socket.on('queue', setQ);
    return () => socket.off('queue', setQ);
  }, []);
  return q;
}
