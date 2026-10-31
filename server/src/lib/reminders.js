import { Appointment } from '../models.js';
import { isoDate, nowMinutes } from '../config.js';
import { notify, fmt, tok } from './notify.js';

// Runs every 10 minutes. Sends each customer a reminder the day before (from 09:00) and
// another about two hours ahead. Each reminder is sent once. If the server is asleep
// (Render free plan) nothing runs until it wakes up.
export function startReminders(app) {
  const run = async () => {
    try {
      const now = new Date(), nowMin = nowMinutes();
      const tm = new Date(now); tm.setDate(tm.getDate() + 1);
      const line = (a) => `${a.service?.name || 'Your appointment'} with ${a.stylist?.name || 'your stylist'} at ${fmt(a.start)} (token ${tok(a.token)}).` +
        (a.depositAmount && !a.depositPaid ? ` A deposit of $${a.depositAmount} is still due.` : '');

      if (nowMin >= 540) {
        const list = await Appointment.find({ date: isoDate(tm), status: 'booked', remindDay: { $ne: true }, customer: { $ne: null }, createdAt: { $lt: new Date(Date.now() - 12 * 3600e3) } }).populate('service stylist');
        for (const a of list) {
          await notify(app, a.customer, { kind: 'reminder', title: 'Reminder: appointment tomorrow', body: line(a) });
          a.remindDay = true; await a.save();
        }
      }
      const soon = await Appointment.find({ date: isoDate(now), status: 'booked', remindSoon: { $ne: true }, customer: { $ne: null }, start: { $gt: nowMin, $lte: nowMin + 120 }, createdAt: { $lt: new Date(Date.now() - 3 * 3600e3) } }).populate('service stylist');
      for (const a of soon) {
        await notify(app, a.customer, { kind: 'reminder', title: 'Your appointment is soon', body: line(a) });
        a.remindSoon = true; await a.save();
      }
    } catch (e) { console.error('Reminder run failed:', e.message); }
  };
  setInterval(run, 10 * 60 * 1000);
  run();
}
