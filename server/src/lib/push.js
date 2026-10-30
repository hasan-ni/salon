import webpush from 'web-push';
import { PushSub } from '../models.js';

// Phone alerts that arrive even when the website is closed (Web Push, free).
// Needs VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT. Without them, this does nothing.
const E = process.env;
export const pushEnabled = () => !!(E.VAPID_PUBLIC_KEY && E.VAPID_PRIVATE_KEY);
let ready = false;
function init() {
  if (ready) return true;
  if (!pushEnabled()) return false;
  webpush.setVapidDetails(E.VAPID_SUBJECT || `mailto:${E.MAIL_FROM || 'admin@example.com'}`, E.VAPID_PUBLIC_KEY, E.VAPID_PRIVATE_KEY);
  ready = true;
  return true;
}

export async function sendPush(userId, { kind, title, body }) {
  if (!init()) return;
  const subs = await PushSub.find({ user: userId });
  const urgent = kind === 'turn' || kind === 'next';
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } },
        JSON.stringify({ title, body, kind, url: '/book' }),
        { TTL: urgent ? 600 : 12 * 3600, urgency: urgent ? 'high' : 'normal' },
      );
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await s.deleteOne(); // the phone removed its subscription
      else console.error('Push failed:', e.statusCode || e.message);
    }
  }));
}
