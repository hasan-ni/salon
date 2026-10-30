import { api } from './api.js';

const toBytes = (s) => {
  const raw = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
// iPhones only allow alerts for sites added to the Home Screen.
export const needsHomeScreen = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone;

// 'unsupported' | 'ios' | 'notset' | 'denied' | 'off' | 'on'
export async function pushState() {
  if (needsHomeScreen() && !pushSupported()) return 'ios';
  if (!pushSupported()) return 'unsupported';
  const { key } = await api('/push/key').catch(() => ({ key: null }));
  if (!key) return 'notset';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

export async function enablePush() {
  const { key } = await api('/push/key');
  if (!key) throw new Error('Phone alerts are not set up yet.');
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Alerts were blocked. Allow notifications for this site in your browser settings.');
  await navigator.serviceWorker.register('/sw.js');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(key) });
  await api('/push/subscribe', { method: 'POST', body: sub.toJSON() });
}

export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}
