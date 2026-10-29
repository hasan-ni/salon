# Maison Lilac: salon booking starter (MERN)

Customer and staff logins with roles, a booking API that cannot double-book, a daily token counter, and a live "Now serving" board.

## What you need
- Node.js 18 or newer
- MongoDB running locally (`mongodb://127.0.0.1:27017`), or a free MongoDB Atlas connection string

## Run it
```bash
# 1. API
cd server
cp .env.example .env        # then edit JWT_SECRET, ADMIN_EMAIL and ADMIN_PASSWORD
npm install
npm run seed                # creates the admin account, sample services and stylists
npm run dev                 # http://localhost:4000

# 2. Website (second terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

## Try it
1. Open http://localhost:5173/login. As a customer, enter a phone number. In development the code is printed in the server terminal and shown on the page.
2. Book a service. You get a token such as T-001.
3. Open a private window and sign in at **Staff sign-in** with the admin email and password from `.env`. Open the Staff page and press **Call next**.
4. Open http://localhost:5173/display on a second screen. It updates live and chimes when a number is called.
5. Try booking the same time in two windows at once. Only one succeeds; the other is told the time was just taken.

## How the main parts work
| Part | Where | What it does |
|---|---|---|
| Roles and login | `server/src/routes/auth.js`, `middleware.js` | Customers sign in with a phone number and a one-time code. Staff use email and password. A signed token is kept in an httpOnly cookie. `need('staff','admin')` protects each route on the server. Only an admin can create staff (`POST /api/auth/staff`). |
| No double booking | `server/src/models.js`, `routes/appointments.js` | Each 30-minute block is a `Block` document with a unique index on stylist, date and block. MongoDB rejects the second booking even if two arrive at once, and any partly inserted blocks are removed. |
| Token counter | `routes/appointments.js` | `findOneAndUpdate` with `$inc` on a per-day counter gives every booking the next number, with no duplicates. |
| Live board | `lib/queue.js`, `routes/queue.js`, `client/src/pages/Display.jsx` | "Call next" saves the number, then Socket.IO pushes the new queue (serving, waiting, estimated wait) to every open screen. |
| Estimated wait | `lib/queue.js` | Minutes of the bookings ahead, divided by the number of stylists, rounded up to 5. |
| Deposits and reminders | `config.js`, `pages/Staff.jsx` | Services of 120+ minutes need a 30% deposit that staff mark as paid. Reminder buttons open WhatsApp or SMS with the message filled in. |

Change opening hours, deposit rules and the booking window in `server/src/config.js`.

## Create more staff
Sign in as admin, then send (from your own tool, or add a screen for it later):
```
POST /api/auth/staff   { "name": "Leo", "email": "leo@example.com", "password": "at least 8 chars" }
```

## Before going live
- Put the API and website behind HTTPS and set `NODE_ENV=production`. That turns off the on-screen code and makes the cookie secure-only.
- Use a long random `JWT_SECRET`.
- Send real SMS: replace the console message in `server/src/lib/sms.js` with your provider (Twilio and similar). Until then no customer receives a code in production.
- Set `TZ` to the salon's timezone so "today" and opening hours match.
- For hosting, serve the built client (`npm run build`) from the same domain as the API, or set `CLIENT_ORIGIN` and CORS to the real website address.
- Back up the database.

## Not included yet
Automatic reminder messages, online card payments, a waitlist, per-stylist working hours and days off, a screen for creating staff, and tests.
