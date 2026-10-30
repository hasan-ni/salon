import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { User, LoginChallenge } from '../models.js';
import { COOKIE, cookieOpts, signToken } from '../middleware.js';
import { mailEnabled } from '../lib/mail.js';

// Free sign-in with WhatsApp.
// The customer taps a button that opens WhatsApp with a ready-made message to the salon's number.
// When they send it, WhatsApp tells our webhook which phone number it came from. WhatsApp has
// already verified that number, so we know who they are. No code is sent out, so nothing is charged:
// a customer who messages first opens a free 24-hour window, and our one reply falls inside it.
const E = process.env;
const enabled = () => !!(E.WHATSAPP_NUMBER && E.WHATSAPP_TOKEN && E.WHATSAPP_PHONE_ID && E.WHATSAPP_VERIFY_TOKEN && E.WHATSAPP_APP_SECRET);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const publicUser = (u) => ({ id: String(u._id), name: u.name, role: u.role });

export const waAuth = Router();
export const waHook = Router();

// Tells the website which customer sign-in options are switched on.
waAuth.get('/config', (_req, res) => {
  const otp = E.NODE_ENV !== 'production' || E.SHOW_DEV_CODE === 'true' || !!(E.TWILIO_SID && E.TWILIO_TOKEN && E.TWILIO_FROM);
  res.json({ whatsapp: enabled(), otp, email: mailEnabled() || E.NODE_ENV !== 'production' || E.SHOW_DEV_CODE === 'true' });
});

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again later.' } });

// Step 1: the website asks for a sign-in link.
waAuth.post('/start', limiter, async (_req, res) => {
  if (!enabled()) return res.status(503).json({ error: 'WhatsApp sign-in is not set up.' });
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  const secret = crypto.randomBytes(24).toString('hex');
  await LoginChallenge.create({ secretHash: sha(secret), code });
  const text = encodeURIComponent(`Sign in LILAC-${code}`);
  res.json({ secret, link: `https://wa.me/${E.WHATSAPP_NUMBER.replace(/\D/g, '')}?text=${text}` });
});

// Step 2: the website checks every couple of seconds whether the message has arrived.
waAuth.post('/check', limiter, async (req, res) => {
  const p = z.object({ secret: z.string().min(20), name: z.string().trim().min(2).max(60).optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid request.' });
  const c = await LoginChallenge.findOne({ secretHash: sha(p.data.secret) });
  if (!c) return res.status(404).json({ error: 'That sign-in expired. Please try again.' });
  if (!c.verified) return res.json({ pending: true });
  let user = await User.findOne({ phone: c.phone });
  if (!user) {
    if (!p.data.name) return res.json({ needName: true }); // first visit: ask for a name
    user = await User.create({ phone: c.phone, name: p.data.name, role: 'customer' });
  }
  await c.deleteOne();
  res.cookie(COOKIE, signToken(user), cookieOpts());
  res.json({ user: publicUser(user) });
});

// Meta calls this once, when you register the webhook, to check the address belongs to you.
waHook.get('/', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && E.WHATSAPP_VERIFY_TOKEN && req.query['hub.verify_token'] === E.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

// Meta calls this for every incoming message. We check the signature so nobody else can fake one.
waHook.post('/', async (req, res) => {
  const sig = String(req.get('x-hub-signature-256') || '');
  const want = 'sha256=' + crypto.createHmac('sha256', E.WHATSAPP_APP_SECRET || '').update(req.rawBody || '').digest('hex');
  if (!E.WHATSAPP_APP_SECRET || sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return res.sendStatus(403);
  res.sendStatus(200);

  try {
    for (const entry of req.body.entry || []) for (const change of entry.changes || []) for (const m of change.value?.messages || []) {
      if (m.type !== 'text') continue;
      const hit = /LILAC-([A-F0-9]{8})/i.exec(m.text?.body || '');
      if (!hit) continue;
      const c = await LoginChallenge.findOne({ code: hit[1].toUpperCase(), verified: false });
      if (!c) continue;
      c.phone = '+' + m.from; c.verified = true; await c.save();
      // Free reply: the customer messaged us first, so a 24-hour window is open.
      fetch(`https://graph.facebook.com/${E.WHATSAPP_API_VERSION || 'v21.0'}/${E.WHATSAPP_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${E.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: m.from, type: 'text', text: { body: 'You are signed in. Go back to the Maison Lilac page.' } }),
      }).catch((e) => console.error('WhatsApp reply failed', e.message));
    }
  } catch (e) { console.error('WhatsApp webhook error', e); }
});
