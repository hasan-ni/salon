import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Appointment, Block, Counter, Service, Stylist, User } from '../models.js';
import { need } from '../middleware.js';
import { OPEN, CLOSE, STEP, DEP_MIN, DEP_PCT, MAX_DAYS_AHEAD, isoDate, validDate, isSunday, nowMinutes, daysFromToday } from '../config.js';
import { todayQueue, eta, broadcast } from '../lib/queue.js';
import { notify, notifyStaff, fmt, tok, longDate } from '../lib/notify.js';

const r = Router();
const oid = mongoose.isValidObjectId;
const isStaff = (u) => ['staff', 'admin'].includes(u.role);

const blocksFor = (start, dur) => { const a = []; for (let m = start; m < start + dur; m += STEP) a.push(m); return a; };
const takenSet = async (date) =>
  new Set((await Block.find({ date }).select('stylist block').lean()).map((b) => `${b.stylist}_${b.block}`));
const freeStylists = (pool, start, dur, taken) =>
  pool.filter((s) => blocksFor(start, dur).every((m) => !taken.has(`${s._id}_${m}`)));
const poolFor = (stylistId) =>
  stylistId === 'any' ? Stylist.find().sort({ _id: 1 }).lean() : oid(stylistId) ? Stylist.find({ _id: stylistId }).lean() : [];
const dateError = (date) => {
  if (!validDate(date)) return 'Invalid date.';
  if (isSunday(date)) return 'We are closed on Sundays.';
  const d = daysFromToday(date);
  if (d < 0) return 'That day has passed.';
  if (d > MAX_DAYS_AHEAD) return `Bookings open ${MAX_DAYS_AHEAD} days ahead.`;
  return null;
};

// THE UNIQUE-BLOCK CHECK.
// Each 30-minute block is one Block document. The unique index on (stylist, date, block)
// means MongoDB itself rejects a second booking for the same stylist and time, even if two
// requests arrive at the same instant. If any block fails we remove the ones we inserted.
async function tryBlocks(stylist, date, start, dur, appointment) {
  const docs = blocksFor(start, dur).map((block) => ({ stylist, date, block, appointment }));
  try {
    await Block.insertMany(docs, { ordered: true });
    return true;
  } catch (e) {
    await Block.deleteMany({ appointment });
    if (e?.code === 11000 || e?.writeErrors?.length) return false; // duplicate key: someone else got it
    throw e;
  }
}

// Public: which start times are open for a service, stylist and day.
r.get('/availability', async (req, res) => {
  const { date, serviceId, stylistId = 'any' } = req.query;
  const err = dateError(String(date));
  if (err) return res.status(400).json({ error: err });
  if (!oid(serviceId)) return res.status(400).json({ error: 'Choose a service.' });
  const svc = await Service.findById(serviceId).lean();
  if (!svc) return res.status(404).json({ error: 'Service not found.' });
  const [pool, taken] = await Promise.all([poolFor(String(stylistId)), takenSet(date)]);
  const today = date === isoDate(), now = nowMinutes(), out = [];
  for (let m = OPEN; m + svc.minutes <= CLOSE; m += STEP) {
    out.push({ start: m, ok: !(today && m <= now) && freeStylists(pool, m, svc.minutes, taken).length > 0 });
  }
  res.json(out);
});

const bookSchema = z.object({
  date: z.string(), start: z.number().int(), serviceId: z.string(), stylistId: z.string().default('any'),
  name: z.string().trim().min(2).optional(), phone: z.string().trim().min(7).optional(), // walk-ins entered by staff
});

r.post('/', need(), async (req, res) => {
  const p = bookSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid booking.' });
  const { date, start, serviceId, stylistId, name, phone } = p.data;
  const err = dateError(date);
  if (err) return res.status(400).json({ error: err });
  if (!oid(serviceId)) return res.status(400).json({ error: 'Choose a service.' });
  const svc = await Service.findById(serviceId).lean();
  if (!svc) return res.status(404).json({ error: 'Service not found.' });
  if (start % STEP || start < OPEN || start + svc.minutes > CLOSE) return res.status(400).json({ error: 'Outside opening hours.' });
  if (date === isoDate() && start <= nowMinutes()) return res.status(400).json({ error: 'That time has passed.' });
  const pool = await poolFor(stylistId);
  if (!pool.length) return res.status(400).json({ error: 'Stylist not found.' });

  const apptId = new mongoose.Types.ObjectId();
  const candidates = freeStylists(pool, start, svc.minutes, await takenSet(date));
  let chosen = null;
  for (const s of candidates) {
    if (await tryBlocks(s._id, date, start, svc.minutes, apptId)) { chosen = s; break; }
  }
  if (!chosen) return res.status(409).json({ error: 'That time was just taken. Pick another time.' });

  try {
    const walkIn = isStaff(req.user) && name;
    const user = walkIn ? null : await User.findById(req.user.id).lean();
    // Atomic counter: every booking for a date gets the next number, with no duplicates.
    const { seq: token } = await Counter.findOneAndUpdate({ _id: `token:${date}` }, { $inc: { seq: 1 } }, { upsert: true, new: true });
    const appt = await Appointment.create({
      _id: apptId, customer: user?._id, customerName: walkIn ? name : user.name, phone: walkIn ? (phone || '') : user.phone, email: walkIn ? '' : user.email,
      service: svc._id, stylist: chosen._id, date, start, dur: svc.minutes, token,
      depositAmount: svc.minutes >= DEP_MIN ? Math.round(svc.price * DEP_PCT) : 0,
    });
    await broadcast(req.app, date);
    if (user) notify(req.app, user._id, { kind: 'booked', title: 'Booking confirmed', body: `${svc.name} with ${chosen.name} on ${longDate(date)} at ${fmt(start)}. Your token is ${tok(token)}.` + (appt.depositAmount ? ` A deposit of $${appt.depositAmount} is due to confirm it.` : '') });
    notifyStaff(req.app, { kind: 'staff-booked', title: 'New booking', body: `${appt.customerName}: ${svc.name} with ${chosen.name} on ${longDate(date)} at ${fmt(start)} (token ${tok(token)}).` }, req.user.id);
    res.status(201).json({ ...appt.toObject(), serviceName: svc.name, stylistName: chosen.name });
  } catch (e) {
    await Block.deleteMany({ appointment: apptId }); // never leave a time locked by a failed booking
    throw e;
  }
});

// Customer: my upcoming bookings, with tokens ahead and estimated wait for today.
r.get('/mine', need(), async (req, res) => {
  const today = isoDate();
  const [list, q] = await Promise.all([
    Appointment.find({ customer: req.user.id, date: { $gte: today }, status: { $in: ['booked', 'serving'] } })
      .sort({ date: 1, start: 1 }).populate('service stylist').lean(),
    todayQueue(),
  ]);
  res.json(list.map((a) => {
    const out = { ...a, serviceName: a.service?.name, stylistName: a.stylist?.name };
    if (a.date === today && a.status === 'booked') {
      const ahead = q.ahead.filter((x) => x.token < a.token);
      out.ahead = ahead.length;
      out.etaMin = eta(ahead, q.stylists);
    }
    return out;
  }));
});

// Staff: the day's appointments, including client phone numbers.
r.get('/', need('staff', 'admin'), async (req, res) => {
  const date = String(req.query.date || isoDate());
  if (!validDate(date)) return res.status(400).json({ error: 'Invalid date.' });
  const list = await Appointment.find({ date, status: { $ne: 'cancelled' } }).sort({ start: 1 }).populate('service stylist').lean();
  res.json(list.map((a) => ({ ...a, serviceName: a.service?.name, stylistName: a.stylist?.name })));
});

// Customers can cancel their own booking; staff can cancel any. Cancelling frees the time.
r.patch('/:id/cancel', need(), async (req, res) => {
  if (!oid(req.params.id)) return res.status(404).json({ error: 'Not found.' });
  const a = await Appointment.findById(req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found.' });
  if (!isStaff(req.user) && String(a.customer) !== req.user.id) return res.status(403).json({ error: 'Not allowed.' });
  if (['done', 'cancelled'].includes(a.status)) return res.status(409).json({ error: 'Already finished.' });
  a.status = 'cancelled';
  await a.save();
  await Block.deleteMany({ appointment: a._id });
  await broadcast(req.app, a.date);
  if (!isStaff(req.user)) {
    await a.populate('service');
    notifyStaff(req.app, { kind: 'staff-cancelled', title: 'Customer cancelled', body: `${a.customerName} cancelled ${a.service?.name || 'an appointment'} on ${longDate(a.date)} at ${fmt(a.start)} (token ${tok(a.token)}). That time is free again.` });
  }
  if (a.customer && String(a.customer) !== req.user.id) notify(req.app, a.customer, { kind: 'cancelled', title: 'Appointment cancelled', body: `Your appointment on ${longDate(a.date)} at ${fmt(a.start)} (token ${tok(a.token)}) was cancelled by the salon. Please book a new time.` });
  res.json({ ok: true });
});

r.patch('/:id/deposit-paid', need('staff', 'admin'), async (req, res) => {
  if (!oid(req.params.id)) return res.status(404).json({ error: 'Not found.' });
  const a = await Appointment.findByIdAndUpdate(req.params.id, { depositPaid: true }, { new: true });
  if (!a) return res.status(404).json({ error: 'Not found.' });
  await broadcast(req.app, a.date);
  if (a.customer) notify(req.app, a.customer, { kind: 'deposit', title: 'Deposit received', body: `Thank you. Your deposit for ${longDate(a.date)} at ${fmt(a.start)} (token ${tok(a.token)}) is confirmed.` });
  res.json({ ok: true });
});

export default r;
