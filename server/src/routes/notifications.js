import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Notification } from '../models.js';
import { need } from '../middleware.js';

const r = Router();

// My latest messages and how many are unread.
r.get('/', need(), async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(30).lean(),
    Notification.countDocuments({ user: req.user.id, read: false }),
  ]);
  res.json({ items, unread });
});

// Mark messages read: pass { ids: [...] } for some, or nothing for all of mine.
r.post('/read', need(), async (req, res) => {
  const p = z.object({ ids: z.array(z.string()).optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid request.' });
  const filter = { user: req.user.id, read: false };
  if (p.data.ids) filter._id = { $in: p.data.ids.filter((i) => mongoose.isValidObjectId(i)) };
  await Notification.updateMany(filter, { read: true });
  res.json({ ok: true });
});

export default r;
