import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { User, EmailOtp } from '../models.js';
import { COOKIE, cookieOpts, signToken } from '../middleware.js';
import { sendMail, mailEnabled } from '../lib/mail.js';

const r = Router();
const E = process.env;
const devShow = () => !mailEnabled() && (E.NODE_ENV !== 'production' || E.SHOW_DEV_CODE === 'true');
const hash = (email, code) => crypto.createHash('sha256').update(`${email}:${code}:${E.JWT_SECRET}`).digest('hex');
const emailSchema = z.string().trim().toLowerCase().email().max(120);
const publicUser = (u) => ({ id: String(u._id), name: u.name, role: u.role });
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again later.' } });
const STAFF_MSG = 'This email belongs to a staff account. Please use Staff sign-in.';

// Step 1: email a 6-digit code.
r.post('/request', limiter, async (req, res) => {
  const p = z.object({ email: emailSchema }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Enter a valid email address.' });
  const email = p.data.email;
  // Staff and admin accounts must always use their password, never an emailed code.
  const existing = await User.findOne({ email });
  if (existing && existing.role !== 'customer') return res.status(400).json({ error: STAFF_MSG });
  // One code per minute per address, so nobody can flood someone else's inbox.
  if (await EmailOtp.findOne({ email, createdAt: { $gt: new Date(Date.now() - 60_000) } })) {
    return res.status(429).json({ error: 'A code was just sent. Wait a minute before asking again.' });
  }
  const code = String(crypto.randomInt(100000, 1000000));
  await EmailOtp.deleteMany({ email });
  await EmailOtp.create({ email, codeHash: hash(email, code) });
  await sendMail(email, 'Your Maison Lilac sign-in code', `Your sign-in code is ${code}. It expires in 5 minutes.\n\nIf you did not ask for this, ignore this email.`);
  res.json({ ok: true, ...(devShow() ? { devCode: code } : {}) });
});

// Step 2: check the code, create the account on first visit, sign in.
r.post('/verify', limiter, async (req, res) => {
  const p = z.object({ email: emailSchema, code: z.string().length(6), name: z.string().trim().min(2).max(60).optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid request.' });
  const { email, code, name } = p.data;
  const otp = await EmailOtp.findOne({ email });
  if (!otp) return res.status(400).json({ error: 'Code expired. Request a new one.' });
  if (otp.attempts >= 5) { await otp.deleteOne(); return res.status(429).json({ error: 'Too many wrong codes. Request a new one.' }); }
  const ok = crypto.timingSafeEqual(Buffer.from(otp.codeHash), Buffer.from(hash(email, code)));
  if (!ok) { otp.attempts += 1; await otp.save(); return res.status(400).json({ error: 'Wrong code.' }); }
  await otp.deleteOne();
  let user = await User.findOne({ email });
  if (user && user.role !== 'customer') return res.status(400).json({ error: STAFF_MSG });
  if (!user) {
    if (!name) return res.status(400).json({ error: 'Enter your name.' });
    user = await User.create({ email, name, role: 'customer' });
  }
  res.cookie(COOKIE, signToken(user), cookieOpts());
  res.json({ user: publicUser(user) });
});

export default r;
