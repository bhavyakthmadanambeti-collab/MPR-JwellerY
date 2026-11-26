# MPR Jewellery starter
React + TypeScript + Tailwind frontend and Express + SQLite backend.

## Run
- Node.js 20+
- `cd server && cp .env.example .env && npm install && npm run dev`
- `cd client && npm install && npm run dev`
- Frontend: http://localhost:5173; API: http://localhost:4000

Set OWNER_EMAIL, OWNER_PASSWORD and OWNER_UPI in server/.env. Use a unique password and change the example secret.
Payments are demo/pending only. For live payments integrate a certified payment gateway (e.g. PhonePe PG or Razorpay), use server-side signature verification, and never mark orders paid based on browser-only confirmation.
