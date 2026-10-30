import bcrypt from 'bcryptjs';
import { User, Service, Stylist } from '../models.js';

// Adds the admin account, sample services and stylists if they are missing.
// Safe to run on every start: it never overwrites or duplicates anything.
export async function seedIfEmpty() {
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  if (email && process.env.ADMIN_PASSWORD && !(await User.findOne({ email }))) {
    await User.create({ name: 'Owner', email, role: 'admin', passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12) });
    console.log(`Created admin ${email}`);
  }
  if (!(await Service.countDocuments())) {
    await Service.insertMany([
      { name: 'Haircut & style', minutes: 45, price: 45 },
      { name: 'Fringe or beard trim', minutes: 15, price: 15 },
      { name: 'Blow-dry', minutes: 30, price: 30 },
      { name: 'Deep conditioning treatment', minutes: 30, price: 35 },
      { name: 'Full colour', minutes: 120, price: 110 },
      { name: 'Highlights', minutes: 150, price: 140 },
    ]);
    console.log('Added services');
  }
  if (!(await Stylist.countDocuments())) {
    await Stylist.insertMany([
      { name: 'Amina', title: 'Colour specialist' },
      { name: 'Leo', title: 'Cuts & beards' },
      { name: 'Sana', title: 'Stylist' },
    ]);
    console.log('Added stylists');
  }
}
