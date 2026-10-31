import { Router } from 'express';
import { Service, Stylist } from '../models.js';
import { DEP_MIN, DEP_PCT, SALON_TZ, SESSIONS, CLOSED_DAYS, isoDate, nowMinutes } from '../config.js';

const r = Router();
r.get('/services', async (_req, res) => {
  const list = await Service.find().sort({ minutes: 1 }).lean();
  res.json(list.map((s) => ({ ...s, deposit: s.minutes >= DEP_MIN ? Math.round(s.price * DEP_PCT) : 0 })));
});
// The salon's clock, so the website never relies on the visitor's own device time.
r.get('/time', (_req, res) => { const today = isoDate(); res.json({ tz: SALON_TZ, today, minutes: nowMinutes(), dow: new Date(today + 'T00:00:00').getDay(), sessions: SESSIONS, closed: CLOSED_DAYS }); });
r.get('/stylists', async (_req, res) => res.json(await Stylist.find().lean()));
export default r;
