import { useEffect, useRef, useState } from 'react';
import { useQueue } from '../useQueue.js';
import { tok } from '../util.js';

// Public full-screen board for a TV in the salon. Shows numbers only, never names.
export default function Display() {
  const q = useQueue();
  const ctx = useRef(null), last = useRef(null);
  const [sound, setSound] = useState(false);

  const enableSound = () => { // browsers only allow audio after a tap
    ctx.current = new (window.AudioContext || window.webkitAudioContext)();
    setSound(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    if (last.current !== null && q.serving !== last.current && q.serving > 0 && ctx.current) {
      const c = ctx.current, o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination); o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.8);
      o.start(); o.stop(c.currentTime + 0.8);
    }
    last.current = q.serving;
  }, [q.serving]);

  return (
    <div className="screen" role="status" aria-live="polite">
      <p>Now serving</p>
      <div className="big">{q.serving ? tok(q.serving) : '—'}</div>
      <p>{q.waiting ? `${q.waiting} waiting · about ${q.etaMin} min` : 'No one waiting'}</p>
      {q.next.length > 0 && <div className="nextrow"><span>Next</span>{q.next.map((t) => <b key={t}>{tok(t)}</b>)}</div>}
      {!sound && <button className="ghost light" onClick={enableSound}>Tap to turn on sound and full screen</button>}
    </div>
  );
}
