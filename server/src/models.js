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
}, { timestamps: true });
apptSchema.index({ date: 1, token: 1 });
export const Appointment = model('Appointment', apptSchema);

// Atomic counters: _id is "token:YYYY-MM-DD".
export const Counter = model('Counter', new Schema({ _id: String, seq: { type: Number, default: 0 } }));
// "Now serving" number per day: _id is the date.
export const Board = model('Board', new Schema({ _id: String, serving: { type: Number, default: 0 } }));
