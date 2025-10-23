# ngrok Setup Guide

This guide explains how to expose your RTMS Meeting Assistant to the internet using ngrok for Zoom webhook integration.

## Quick Answer

**Use PORT 3000** (Express server, not Vite dev server)

```bash
# Terminal 1: Build and run production server
cd client && npm run build && cd ..
node index.js

# Terminal 2: Start ngrok tunnel
ngrok http 3000
```

## Why Port 3000?

- ✅ Express serves the built React app from `client/dist`
- ✅ Handles Zoom webhooks at `/webhook`
- ✅ Serves all API endpoints (`/api/meetings`, `/search`, etc.)
- ✅ Serves static assets (`/recordings`, `/static`)
- ❌ Port 5173 (Vite dev server) is ONLY for local development with HMR

## Step-by-Step Setup

### 1. Build the Frontend

```bash
cd client
npm run build
cd ..
```

This creates `client/dist/` with optimized production files.

### 2. Start Express Server

```bash
node index.js
```

You should see:
```
Server running at http://localhost:3000
Webhook endpoint available at http://localhost:3000/webhook
```

### 3. Start ngrok Tunnel

In a **separate terminal**:

```bash
ngrok http 3000
```

You'll see output like:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

Copy the `https://abc123.ngrok.io` URL.

### 4. Configure Zoom App

In the [Zoom Marketplace](https://marketplace.zoom.us):

1. **App URL**: `https://abc123.ngrok.io/home`
2. **Webhook URL**: `https://abc123.ngrok.io/webhook`
3. **Allowed Redirect URLs**: `https://abc123.ngrok.io`

### 5. Test the Setup

**Test webhook:**
```bash
curl -X POST https://abc123.ngrok.io/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"test"}'
```

**Test React app:**
Open `https://abc123.ngrok.io` in your browser

**Test API:**
```bash
curl https://abc123.ngrok.io/api/meetings
```

## Vite Config - No Changes Needed

Your `client/vite.config.js` proxy settings are **ONLY for local development**:

```javascript
server: {
  proxy: {
    '/api': 'http://localhost:3000',
    // ... other proxies
  }
}
```

This is used when running `npm run dev` on port 5173 locally. **ngrok doesn't use Vite proxy.**

## Production Workflow

For ngrok/production, always use this workflow:

```bash
# 1. Build frontend (do this after any code changes)
cd client && npm run build && cd ..

# 2. Start Express
node index.js

# 3. Tunnel with ngrok
ngrok http 3000
```

## Development Workflow (Local Only)

For local development **without** ngrok:

```bash
# Terminal 1: Backend
node index.js

# Terminal 2: Frontend with HMR
cd client && npm run dev

# Visit http://localhost:5173 (Vite proxies to Express)
```

**Do NOT use port 5173 with ngrok** - Zoom webhooks won't work.

## Common Issues

### Issue: Zoom webhooks not received

**Solution:**
- Ensure ngrok is pointing to port **3000** (not 5173)
- Check Express logs for incoming requests
- Verify webhook URL in Zoom Marketplace matches ngrok URL

### Issue: React app shows blank page

**Solution:**
```bash
# Rebuild frontend
cd client && npm run build && cd ..
# Restart Express
node index.js
```

### Issue: Video/transcript files not loading

**Solution:**
- Videos are served from `/recordings` route
- Ensure Express static middleware is configured:
```javascript
app.use('/recordings', express.static(path.join(__dirname, 'recordings')));
```

### Issue: "Cannot GET /meetings" or routing errors

**Solution:**
- Ensure Express catch-all route is **last**:
```javascript
// API routes first
app.get('/api/meetings', ...)
// ...

// SPA catch-all LAST
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client/dist", "index.html"));
});
```

### Issue: CSP blocking scripts/styles

**Solution:**
CSP headers have been updated in `index.js` to allow:
- `'unsafe-inline'` for scripts/styles (needed for React)
- `connectSrc` includes `https://openrouter.ai`
- `crossOriginEmbedderPolicy: false` for video playback

## ngrok Free vs Paid

**Free tier:**
- ✅ Random URLs (e.g., `abc123.ngrok.io`)
- ✅ Sufficient for development/testing
- ❌ URL changes on restart (must update Zoom config)

**Paid tier:**
- ✅ Static domain (e.g., `myapp.ngrok.io`)
- ✅ Persistent URL across restarts
- ✅ Better for ongoing development

## Security Considerations

### For Development (Current Setup)

- ✅ Helmet security headers enabled
- ✅ CSP configured but relaxed for ngrok
- ⚠️ `'unsafe-inline'` allowed for scripts/styles (needed for React)
- ⚠️ No HTTPS enforcement on ngrok free tier

### For Production Deployment

When deploying to a real domain:

1. **Tighten CSP:**
```javascript
scriptSrc: ["'self'"], // Remove 'unsafe-inline'
styleSrc: ["'self'"],  // Remove 'unsafe-inline'
```

2. **Enable HSTS:**
```javascript
res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
```

3. **Use environment-based config:**
```javascript
const isDev = process.env.NODE_ENV !== 'production';
const cspDirectives = isDev
  ? { scriptSrc: ["'self'", "'unsafe-inline'"] }
  : { scriptSrc: ["'self'"] };
```

## Monitoring ngrok Traffic

ngrok provides a web interface at http://localhost:4040 when running:

- View all HTTP requests/responses
- Replay requests for debugging
- Inspect headers and payloads
- Useful for debugging Zoom webhook payloads

## Alternative: Using a Reverse Proxy

Instead of ngrok, you could use:

- **localhost.run**: `ssh -R 80:localhost:3000 localhost.run`
- **Cloudflare Tunnel**: `cloudflared tunnel --url http://localhost:3000`
- **serveo.net**: `ssh -R 80:localhost:3000 serveo.net`

All should point to **port 3000**.

## Summary

| Scenario | Port | Command |
|----------|------|---------|
| **Production (ngrok)** | 3000 | `node index.js` + `ngrok http 3000` |
| **Local dev (HMR)** | 5173 | `node index.js` + `cd client && npm run dev` |
| **Production build test** | 3000 | `cd client && npm run build && cd .. && node index.js` |

**For Zoom webhooks: Always use port 3000 with ngrok.**
