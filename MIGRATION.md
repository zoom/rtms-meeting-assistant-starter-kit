# Migration to React Frontend

This document explains the migration from static HTML/JS to React SPA.

## What Changed

### Frontend Architecture

**Before:**
- Static `search.html` and `search.js` served from `/search`
- All-in-one page with search, video playback, and summaries
- No routing or navigation

**After:**
- React SPA with proper routing
- Multiple pages: `/home`, `/meetings`, `/meetings/:id`
- Component-based architecture
- Modern development workflow with Vite

### File Structure

```
client/
├── src/
│   ├── pages/
│   │   ├── HomePage.jsx          # Dashboard with search
│   │   ├── MeetingsListPage.jsx  # List all meetings
│   │   └── MeetingDetailPage.jsx # Individual meeting view
│   ├── styles/
│   │   ├── HomePage.css
│   │   ├── MeetingsListPage.css
│   │   └── MeetingDetailPage.css
│   ├── App.jsx                   # Router setup
│   └── main.jsx                  # Entry point
└── vite.config.js                # Vite config with proxy
```

### Backend Changes

**New API Endpoints:**
- `GET /api/meetings` - List all meetings (with `?limit=N` support)
- `GET /api/meetings/:id` - Get specific meeting metadata

**Updated Routing:**
- API routes defined before catch-all
- Static files for `/recordings` and `/static`
- React SPA served for all other routes (client-side routing)

**Legacy Support:**
- `/search` still serves old `search.html` for backwards compatibility
- Can be removed once migration is complete

## Development Workflow

### Running in Development

**Terminal 1 - Backend:**
```bash
npm start
# or
node index.js
```
Runs Express on http://localhost:3000

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```
Runs Vite dev server on http://localhost:5173

**Vite Proxy Configuration:**
All API calls (`/api/*`, `/search`, `/recordings/*`, `/meeting-summary/*`) are proxied to the Express server.

### Building for Production

```bash
# Build frontend
cd client
npm run build

# Start backend (serves built React app)
cd ..
npm start
```

Visit http://localhost:3000 to see the production build.

## Migration Status

### ✅ Completed
- [x] React Router with proper routes
- [x] Home page with search functionality
- [x] Meetings list page
- [x] Meeting detail page with video playback
- [x] Clickable transcript timeline
- [x] API endpoints for meetings
- [x] Vite proxy configuration
- [x] Express routing for SPA

### 🚧 Future Enhancements (per spec.md)
- [ ] Database integration (replace file-based storage)
- [ ] Live in-meeting view (`/meeting/{currentUuid}`)
- [ ] Real-time transcript updates via WebSocket
- [ ] Action items and highlights extraction
- [ ] User authentication (Sign in with Zoom/Google)
- [ ] Advanced search filters (date range, tags)
- [ ] SSE-based chat endpoint for streaming responses

## Key Implementation Details

### Client-Side Routing

React Router handles all navigation. The Express server serves `index.html` for all routes that don't match API endpoints.

### Transcript Parsing

VTT parsing logic ported from `search.js` to `MeetingDetailPage.jsx`:
```javascript
const parseVTT = (vttText) => {
  // Returns array of { start, end, text }
}
```

### Video Sync

Clicking transcript lines jumps to the corresponding video timestamp:
```javascript
const jumpToTime = (time) => {
  videoRef.current.currentTime = time
}
```

### Meeting Metadata

Currently file-based (reads from `recordings/` directory). Future: database with schema from `schema.ts`.

## Removing Legacy Files

Once confident in the migration, you can remove:
- `static/search.html`
- `static/search.js`
- `GET /search` route in `index.js`

## Troubleshooting

### "Cannot GET /" in production
Make sure you built the frontend:
```bash
cd client && npm run build
```

### API calls fail in development
Ensure both servers are running:
- Express on port 3000
- Vite on port 5173

### Video/transcript not loading
Check that UUIDs are properly sanitized:
```javascript
const safeUuid = meetingId.replace(/[<>:"\/\\|?*=\s]/g, '_')
```

### Routing doesn't work after refresh
Express catch-all route must be **last** in the middleware chain (after all API routes).

## Next Steps

1. Test with real meeting data
2. Add loading states and error handling
3. Implement database migration (follow `schema.ts`)
4. Build live in-meeting view
5. Add WebSocket support for real-time updates
6. Implement authentication
