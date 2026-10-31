import { useEffect, useRef, useState } from 'react';
import { useQueue } from '../useQueue.js';
import { chime, unlockAudio } from '../chime.js';
import { tok } from '../util.js';

// Public full-screen board for a TV in the salon. Shows numbers only, never names.
export default function Display() {
  const q = useQueue();
  const last = useRef(null);
  const [sound, setSound] = useState(false);

  const enableSound = () => { // browsers only allow audio after a tap
    unlockAudio();
    setSound(true);
    chime('turn');                                   // plays once now, so you can hear it works
    document.documentElement.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    if (last.current !== null && q.serving !== last.current && q.serving > 0) chime('turn');
    last.current = q.serving;
  }, [q.serving]);

  return (
    <div className="screen" role="status" aria-live="polite">
      <p>Now serving</p>
      <div className="big">{q.serving ? tok(q.serving) : '—'}</div>
      <p>{q.waiting ? `${q.waiting} waiting · about ${q.etaMin} min` : 'No one waiting'}</p>
      {q.next.length > 0 && <div className="nextrow"><span>Next</span>{q.next.map((t) => <b key={t}>{tok(t)}</b>)}</div>}
      {!sound
        ? <button className="cta wide-btn" onClick={enableSound}>Tap here to turn on sound</button>
        : <button className="ghost light" onClick={() => chime('turn')}>Test sound</button>}
    </div>
  );
}
