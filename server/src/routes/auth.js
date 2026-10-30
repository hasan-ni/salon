import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { User, Otp } from '../models.js';
import { COOKIE, cookieOpts, signToken, need } from '../middleware.js';
import { sendSms } from '../lib/sms.js';

const r = Router();
// SHOW_DEV_CODE=true shows the sign-in code on screen. Use it only for a private demo, never for real customers.
const dev = process.env.NODE_ENV !== 'production' || process.env.SHOW_DEV_CODE === 'true';
const normPhone = (p) => p.replace(/[\s\-()]/g, '');
const phoneSchema = z.string().transform(normPhone).refine((p) => /^\+?\d{7,15}$/.test(p), 'Enter a valid phone number.');
const hash = (phone, code) => crypto.createHash('sha256').update(`${phone}:${code}:${process.env.JWT_SECRET}`).digest('hex');
const bad = (res, e) => res.status(400).json({ error: e.issues?.[0]?.message || 'Invalid input.' });
const publicUser = (u) => ({ id: String(u._id), name: u.name, role: u.role });
const signIn = (res, u) => { res.cookie(COOKIE, signToken(u), cookieOpts()); return res.json({ user: publicUser(u) }); };

// Stops people from using the SMS endpoint to spam numbers.
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many codes requested. Try again later.' } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again later.' } });

// Customer step 1: ask for a code by SMS.
r.post('/otp/request', otpLimiter, async (req, res) => {
  const p = z.object({ phone: phoneSchema }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const phone = p.data.phone;
  const code = String(crypto.randomInt(100000, 1000000));
  await Otp.deleteMany({ phone });
  await Otp.create({ phone, codeHash: hash(phone, code) });
  await sendSms(phone, `Your Maison Lilac code is ${code}. It expires in 5 minutes.`);
  res.json({ ok: true, ...(dev ? { devCode: code } : {}) }); // devCode only outside production
});

// Customer step 2: check the code, create the account on first visit, sign in.
r.post('/otp/verify', loginLimiter, async (req, res) => {
  const p = z.object({ phone: phoneSchema, code: z.string().length(6), name: z.string().trim().min(2).max(60).optional() }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const { phone, code, name } = p.data;
  const otp = await Otp.findOne({ phone });
  if (!otp) return res.status(400).json({ error: 'Code expired. Request a new one.' });
  if (otp.attempts >= 5) { await otp.deleteOne(); return res.status(429).json({ error: 'Too many wrong codes. Request a new one.' }); }
  const ok = crypto.timingSafeEqual(Buffer.from(otp.codeHash), Buffer.from(hash(phone, code)));
  if (!ok) { otp.attempts += 1; await otp.save(); return res.status(400).json({ error: 'Wrong code.' }); }
  await otp.deleteOne();
  let user = await User.findOne({ phone });
  if (!user) {
    if (!name) return res.status(400).json({ error: 'Enter your name.' });
    user = await User.create({ phone, name, role: 'customer' });
  }
  signIn(res, user);
});

// Staff and admin: email and password.
r.post('/staff/login', loginLimiter, async (req, res) => {
  const p = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const user = await User.findOne({ email: p.data.email.toLowerCase(), role: { $in: ['staff', 'admin'] } });
  const ok = user && await bcrypt.compare(p.data.password, user.passwordHash || '');
  if (!ok) return res.status(401).json({ error: 'Wrong email or password.' });
  signIn(res, user);
});

// Only an admin can create staff accounts, so nobody can sign themselves up as staff.
r.post('/staff', need('admin'), async (req, res) => {
  const p = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), role: z.enum(['staff', 'admin']).default('staff') }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  if (await User.findOne({ email: p.data.email.toLowerCase() })) return res.status(409).json({ error: 'That email is already used.' });
  const u = await User.create({ name: p.data.name, email: p.data.email, role: p.data.role, passwordHash: await bcrypt.hash(p.data.password, 12) });
  res.status(201).json({ user: publicUser(u) });
});

r.get('/me', (req, res) => res.json({ user: req.user ? { id: req.user.id, name: req.user.name, role: req.user.role } : null }));
r.post('/logout', (_req, res) => { res.clearCookie(COOKIE, { ...cookieOpts(), maxAge: undefined }); res.json({ ok: true }); });

export default r;
