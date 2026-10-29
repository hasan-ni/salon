import { Appointment, Board, Stylist } from '../models.js';
import { isoDate } from '../config.js';

// Estimated wait: total minutes of the people ahead, shared across stylists, rounded up to 5.
export const eta = (list, stylists) =>
  Math.ceil(list.reduce((s, a) => s + a.dur, 0) / Math.max(stylists, 1) / 5) * 5;

export async function todayQueue(date = isoDate()) {
  const [board, stylists, waiting] = await Promise.all([
    Board.findById(date).lean(),
    Stylist.countDocuments(),
    Appointment.find({ date, status: 'booked' }).sort({ token: 1 }).lean(),
  ]);
  const serving = board?.serving || 0;
  return { date, serving, stylists, ahead: waiting.filter((a) => a.token > serving) };
}

// Public snapshot used by the board, the waiting-room screen and customers. No personal data.
export async function snapshot(date = isoDate()) {
  const q = await todayQueue(date);
  return {
    date,
    serving: q.serving,
    waiting: q.ahead.length,
    etaMin: eta(q.ahead, q.stylists),
    next: q.ahead.slice(0, 5).map((a) => a.token),
  };
}

export async function broadcast(app, date) {
  const io = app.get('io');
  io.emit('queue', await snapshot());
  io.emit('slots', { date });
  io.emit('appointments', { date });
}
