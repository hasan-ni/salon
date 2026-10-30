import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import { seedIfEmpty } from './lib/bootstrap.js';

// Only needed if your network cannot resolve mongodb+srv:// addresses. Set DNS_SERVERS=1.1.1.1,8.8.8.8 in .env
if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(','));

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/salon');
await seedIfEmpty();
await mongoose.disconnect();
