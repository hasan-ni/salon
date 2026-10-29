import 'dotenv/config';
import dns from 'node:dns';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { auth } from './middleware.js';
import { Block, User, Otp, Appointment } from './models.js';
import { snapshot } from './lib/queue.js';
import { seedIfEmpty } from './lib/bootstrap.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import apptRoutes from './routes/appointments.js';
import queueRoutes from './routes/queue.js';

// Only needed if your network cannot resolve mongodb+srv:// addresses. Set DNS_SERVERS=1.1.1.1,8.8.8.8 in .env
if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(','));

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('Set JWT_SECRET (at least 16 characters).');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const io = new Server(server, { cors: { origin, credentials: true } });
app.set('io', io);
app.set('trust proxy', 1); // Render sits in front of the app; needed for secure cookies and rate limiting

app.use(helmet({
  contentSecurityPolicy: {
    directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), 'connect-src': ["'self'", 'ws:', 'wss:'] },
  },
}));
app.use(cors({ origin, credentials: true }));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());
app.use(auth);
app.get('/api/health', (_req, res) => res.json({ ok: true })); // Render checks this to know the app is up
app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api/appointments', apptRoutes);
app.use('/api/queue', queueRoutes);

// In production the built website (client/dist) is served from this same server, so the
// login cookie and the live socket share one address.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Something went wrong.' }); });

io.on('connection', async (socket) => { socket.emit('queue', await snapshot()); });

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/salon');
await Promise.all([Block.init(), User.init(), Otp.init(), Appointment.init()]); // make sure the unique indexes exist
await seedIfEmpty(); // first start: creates the admin, sample services and stylists
const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`API and live board running on port ${port}`));
