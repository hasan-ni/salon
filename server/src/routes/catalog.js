import { Router } from 'express';
import { Service, Stylist } from '../models.js';
import { DEP_MIN, DEP_PCT } from '../config.js';

const r = Router();
r.get('/services', async (_req, res) => {
  const list = await Service.find().sort({ minutes: 1 }).lean();
  res.json(list.map((s) => ({ ...s, deposit: s.minutes >= DEP_MIN ? Math.round(s.price * DEP_PCT) : 0 })));
});
r.get('/stylists', async (_req, res) => res.json(await Stylist.find().lean()));
export default r;
