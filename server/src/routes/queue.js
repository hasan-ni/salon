import { Router } from 'express';
import { Appointment, Board } from '../models.js';
import { need } from '../middleware.js';
import { isoDate } from '../config.js';
import { snapshot, broadcast } from '../lib/queue.js';
import { notify, tok } from '../lib/notify.js';

const r = Router();

// Public: used by the waiting-room screen. Contains no names or phone numbers.
r.get('/today', async (_req, res) => res.json(await snapshot()));

// Staff: call the next waiting token. Cancelled tokens are skipped automatically.
r.post('/next', need('staff', 'admin'), async (req, res) => {
  const date = isoDate();
  const board = await Board.findById(date).lean();
  const serving = board?.serving || 0;
  const nxt = await Appointment.findOne({ date, status: 'booked', token: { $gt: serving } }).sort({ token: 1 });
  if (!nxt) return res.status(409).json({ error: 'No one is waiting.' });
  await Appointment.updateMany({ date, status: { $in: ['serving'] } }, { status: 'done' });
  nxt.status = 'serving'; await nxt.save();
  await Board.findByIdAndUpdate(date, { serving: nxt.token }, { upsert: true });
  await broadcast(req.app, date);
  notify(req.app, nxt.customer, { kind: 'turn', title: 'It’s your turn', body: `Token ${tok(nxt.token)} is being served now.` });
  const after = await Appointment.findOne({ date, status: 'booked', token: { $gt: nxt.token } }).sort({ token: 1 });
  if (after) notify(req.app, after.customer, { kind: 'next', title: 'You’re next', body: `Token ${tok(after.token)} is next in line. Please be ready.` });
  res.json(await snapshot());
});

// Staff: go back one (fixes a mistaken "Call next").
r.post('/prev', need('staff', 'admin'), async (req, res) => {
  const date = isoDate();
  const board = await Board.findById(date).lean();
  const serving = board?.serving || 0;
  const prev = await Appointment.findOne({ date, status: { $in: ['done', 'serving'] }, token: { $lt: serving } }).sort({ token: -1 });
  await Appointment.updateMany({ date, token: serving, status: 'serving' }, { status: 'booked' });
  if (prev) { prev.status = 'serving'; await prev.save(); }
  await Board.findByIdAndUpdate(date, { serving: prev ? prev.token : 0 }, { upsert: true });
  await broadcast(req.app, date);
  res.json(await snapshot());
});

export default r;
