import { Router } from 'express';
import { z } from 'zod';
import { PushSub } from '../models.js';
import { need } from '../middleware.js';
import { pushEnabled } from '../lib/push.js';

const r = Router();

// The public key the browser needs to subscribe. null means phone alerts are not set up.
r.get('/key', (_req, res) => res.json({ key: pushEnabled() ? process.env.VAPID_PUBLIC_KEY : null }));

// Save this phone or browser as a place to send my alerts.
r.post('/subscribe', need(), async (req, res) => {
  const p = z.object({
    endpoint: z.string().url().max(1000).startsWith('https://'),
    keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
  }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid subscription.' });
  await PushSub.findOneAndUpdate({ endpoint: p.data.endpoint }, { user: req.user.id, keys: p.data.keys }, { upsert: true });
  res.json({ ok: true });
});

r.post('/unsubscribe', need(), async (req, res) => {
  const p = z.object({ endpoint: z.string() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid request.' });
  await PushSub.deleteOne({ endpoint: p.data.endpoint, user: req.user.id });
  res.json({ ok: true });
});

export default r;
