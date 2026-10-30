import { Notification, User } from '../models.js';
import { sendMail, mailEnabled } from './mail.js';
import { sendPush } from './push.js';

const pad = (n) => String(n).padStart(2, '0');
export const fmt = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const tok = (n) => 'T-' + String(n || 0).padStart(3, '0');
export const longDate = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

// These messages are also emailed, when the customer signed up with an email address.
const EMAIL_KINDS = new Set(['booked', 'cancelled', 'reminder', 'deposit']);

// Saves an in-app message and pushes it live to that customer's open pages.
export async function notify(app, userId, { kind, title, body }) {
  if (!userId) return; // walk-ins have no account
  try {
    const n = await Notification.create({ user: userId, kind, title, body });
    app.get('io').to('user:' + userId).emit('notification', { _id: n._id, kind, title, body, read: false, createdAt: n.createdAt });
    sendPush(userId, { kind, title, body }).catch((e) => console.error('Push failed:', e.message)); // phone alert, even when the site is closed
    if (EMAIL_KINDS.has(kind) && mailEnabled()) {
      const u = await User.findById(userId).select('email name').lean();
      if (u?.email) sendMail(u.email, title, `Hi ${(u.name || '').split(' ')[0]},\n\n${body}\n\nMaison Lilac`).catch((e) => console.error('Email failed:', e.message));
    }
  } catch (e) { console.error('Notification failed:', e.message); }
}

// Tells the salon team (every staff and admin account) about something, except the person who did it.
export async function notifyStaff(app, { kind, title, body }, excludeId) {
  try {
    const staff = await User.find({ role: { $in: ['staff', 'admin'] } }).select('_id').lean();
    await Promise.all(staff.filter((s) => String(s._id) !== String(excludeId)).map((s) => notify(app, s._id, { kind, title, body })));
  } catch (e) { console.error('Staff notification failed:', e.message); }
}
