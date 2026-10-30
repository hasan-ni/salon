import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name });

export const User = model('User', new Schema({
  name: String,
  phone: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, sparse: true, lowercase: true },
  passwordHash: String,
  role: { type: String, enum: ['customer', 'staff', 'admin'], default: 'customer' },
}, { timestamps: true }));

// One-time codes expire after 5 minutes (TTL index).
export const Otp = model('Otp', new Schema({
  phone: { type: String, index: true },
  codeHash: String,
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: 300 },
}));

export const Service = model('Service', new Schema({ name: String, minutes: Number, price: Number }));
export const Stylist = model('Stylist', new Schema({ name: String, title: String }));

// One document per stylist per 30-minute block. The unique index is what
// makes double booking impossible, even when two requests arrive together.
const blockSchema = new Schema({
  stylist: ref('Stylist'), date: String, block: Number, appointment: ref('Appointment'),
});
blockSchema.index({ stylist: 1, date: 1, block: 1 }, { unique: true });
export const Block = model('Block', blockSchema);

const apptSchema = new Schema({
  customer: ref('User'),
  customerName: String,
  phone: String,
  service: ref('Service'),
  stylist: ref('Stylist'),
  date: String,          // YYYY-MM-DD
  start: Number,         // minutes after midnight
  dur: Number,           // minutes
  token: Number,         // queue number for that date
  status: { type: String, enum: ['booked', 'serving', 'done', 'cancelled', 'noshow'], default: 'booked' },
  depositAmount: { type: Number, default: 0 },
  depositPaid: { type: Boolean, default: false },
  email: String,
  remindDay: { type: Boolean, default: false },   // day-before reminder already sent
  remindSoon: { type: Boolean, default: false },  // two-hour reminder already sent
}, { timestamps: true });
apptSchema.index({ date: 1, token: 1 });
export const Appointment = model('Appointment', apptSchema);

// Atomic counters: _id is "token:YYYY-MM-DD".
export const Counter = model('Counter', new Schema({ _id: String, seq: { type: Number, default: 0 } }));
// "Now serving" number per day: _id is the date.
export const Board = model('Board', new Schema({ _id: String, serving: { type: Number, default: 0 } }));

// One pending "sign in with WhatsApp" attempt. Expires after 10 minutes (TTL index).
// The browser keeps a secret; only its hash is stored here.
export const LoginChallenge = model('LoginChallenge', new Schema({
  secretHash: { type: String, index: true },
  code: { type: String, index: true },
  name: String,
  phone: String,
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 600 },
}));

// A phone or browser that has agreed to receive alerts for a customer.
export const PushSub = model('PushSub', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  endpoint: { type: String, unique: true },
  keys: { p256dh: String, auth: String },
}, { timestamps: true }));

// One-time email sign-in codes, valid for 5 minutes.
export const EmailOtp = model('EmailOtp', new Schema({
  email: { type: String, index: true },
  codeHash: String,
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: 300 },
}));

// In-app messages for a customer. Deleted automatically after 30 days.
export const Notification = model('Notification', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  kind: String,      // booked, cancelled, deposit, reminder, turn, next
  title: String,
  body: String,
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 30 * 24 * 3600 },
}));
