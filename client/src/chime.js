// A short chime made in the browser (no sound file needed).
// Browsers only allow sound after the person has tapped or pressed a key once on the page,
// so unlockAudio() is called on the first tap.
let ctx = null;

export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* no audio available */ }
  return ctx;
}

export const soundOn = () => { try { return localStorage.getItem('lilac-sound') !== 'off'; } catch { return true; } };
export const setSound = (on) => { try { localStorage.setItem('lilac-sound', on ? 'on' : 'off'); } catch { /* ignore */ } };

// Returns false if the browser has not allowed sound yet.
export function chime(kind = 'message') {
  if (!ctx || ctx.state !== 'running') return false;
  const loud = kind === 'turn' || kind === 'next' || kind === 'staff-booked';
  const notes = loud ? [784, 988, 1319] : [880, 1175];
  const t0 = ctx.currentTime;
  notes.forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + i * 0.2;
    o.type = 'sine'; o.frequency.value = f;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(loud ? 0.5 : 0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.start(t); o.stop(t + 0.55);
  });
  return true;
}
