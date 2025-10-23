# Quick Start Guide

## For ngrok/Production (Zoom Webhooks)

```bash
# 1. Build frontend
cd client && npm run build && cd ..

# 2. Start backend
node index.js

# 3. Start ngrok (separate terminal)
ngrok http 3000
```

**Zoom Marketplace Settings:**
- App URL: `https://YOUR-NGROK-URL.ngrok.io/home`
- Webhook URL: `https://YOUR-NGROK-URL.ngrok.io/webhook`

**Access app:** https://YOUR-NGROK-URL.ngrok.io

---

## For Local Development (HMR)

```bash
# Terminal 1: Backend
node index.js

# Terminal 2: Frontend
cd client && npm run dev
```

**Access app:** http://localhost:5173

---

## After Code Changes

**Local dev:** Auto-reloads (HMR)

**Production/ngrok:**
```bash
cd client && npm run build && cd ..
# Restart: node index.js
```

---

## Port Reference

- **3000** = Express (use with ngrok)
- **5173** = Vite dev server (local only)
- **4040** = ngrok web interface

---

See `NGROK_SETUP.md` for detailed setup instructions.
