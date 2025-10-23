# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Zoom Meeting Assistant built on Zoom's Real-Time Media Streams (RTMS) API. It captures live meeting data (audio, video, transcripts) during Zoom meetings and provides AI-powered search, summarization, and playback capabilities. The project has been migrated to a React SPA frontend and will eventually migrate from file-based storage to database integration.

### Technology Stack

- **Backend**: Node.js + Express, WebSocket for RTMS streaming
- **Frontend**: React 19 + Vite with React Router (in `client/` directory)
- **AI/LLM**: OpenRouter API (supports models like Google Gemini 2.5 Pro)
- **Media Processing**: FFmpeg for audio/video muxing
- **Data Storage**: File-based (future: database per spec.md)

## Essential Commands

### Development

```bash
# Install dependencies (first time only)
npm install
cd client && npm install && cd ..

# Development workflow - Run in two terminals:

# Terminal 1: Backend server (port 3000)
node index.js

# Terminal 2: Frontend dev server (port 5173)
cd client && npm run dev

# Production build
cd client && npm run build && cd ..
node index.js
# Visit http://localhost:3000

# Lint frontend code
cd client && npm run lint
```

### Testing

No test suite is currently configured. When adding tests, follow the patterns in package.json scripts.

## Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
# Zoom RTMS credentials
ZOOM_SECRET_TOKEN=your_secret_token
ZOOM_CLIENT_ID=your_client_id
ZOOM_CLIENT_SECRET=your_client_secret
WEBHOOK_PATH=/webhook

# OpenRouter API for AI features
OPENROUTER_API_KEY=your_api_key
OPENROUTER_MODEL=google/gemini-2.5-pro
OPENROUTER_REASONING_ENABLED=true

# Server config
PORT=3000
```

**CRITICAL**: Never commit `.env` files. API keys are sensitive.

## Architecture

### Backend Architecture (index.js)

The backend implements a **dual-WebSocket RTMS client** that connects to Zoom's signaling and media servers:

1. **Webhook Handler** (`POST /webhook`): Receives RTMS lifecycle events from Zoom
   - `meeting.rtms_started`: Initiates WebSocket connections
   - `meeting.rtms_stopped`: Triggers media conversion and summary generation

2. **Signaling WebSocket** (`connectToSignalingWebSocket`):
   - Handles authentication via HMAC signature
   - Subscribes to meeting events (speaker changes, participant join/leave)
   - Provides media server URLs

3. **Media WebSocket** (`connectToMediaWebSocket`):
   - Receives real-time streams (audio msg_type:14, video msg_type:15, transcript msg_type:17)
   - Delegates to specialized handlers: `saveRawAudioAdvance`, `saveRawVideoAdvance`, `writeTranscriptToVtt`

4. **Post-Meeting Pipeline** (triggered on `rtms_stopped`):
   - `convertMeetingMedia()`: FFmpeg conversion of raw streams
   - `muxFirstAudioVideo()`: Combines audio/video into playable MP4
   - **Summary Generation**: Reads `summary_prompt.md`, fills with transcript/events, calls OpenRouter

### Real-Time Media Processing

- **Audio Handling** (`saveRawAudioAdvance.js`):
  - Saves per-participant raw PCM (16-bit, 16 kHz mono)
  - Auto-fills gaps ≥500ms with silent frames to maintain sync

- **Video Handling** (`saveRawVideoAdvance.js`):
  - Combines H.264 streams with SPS/PPS headers
  - Fills gaps with black frames (`black_frame.h264`)

- **Transcript Handling** (`writeTranscriptToVtt.js`):
  - Writes real-time VTT/SRT/TXT formats
  - Uses meeting start time as timestamp baseline

### Directory Structure

```
recordings/{meetingUuid}/          # Per-meeting raw data
  ├── {userId}.raw                 # Raw PCM audio per participant
  ├── combined.h264                # Combined video stream
  ├── transcript.(vtt|srt|txt)     # Real-time transcripts
  ├── event.logs                   # JSON event log
  └── final_output.mp4             # Muxed final video

meeting_summary/{meetingUuid}.md   # AI-generated summaries

client/                            # React SPA (v0.5 → v1 transition)
  ├── src/
  │   ├── App.jsx                  # Main app router
  │   ├── SearchApp.jsx            # Search interface
  │   └── main.jsx                 # Entry point
  └── dist/                        # Production build

schema.ts                          # TypeScript schema (future DB model)
spec.md                            # Product roadmap & API design
```

### Frontend Architecture (React)

**Current State** (v0.5 - COMPLETED):
- ✅ `/home`: Dashboard with OpenRouter-powered search over meeting summaries
- ✅ `/meetings`: List view with search/filter
- ✅ `/meetings/:id`: Playback with video, clickable transcript, and summary
- 🚧 `/meeting/{uuid}`: In-meeting live view (not yet implemented)

**React Router Setup:**
```javascript
// client/src/App.jsx
<Routes>
  <Route path="/" element={<Navigate to="/home" />} />
  <Route path="/home" element={<HomePage />} />
  <Route path="/meetings" element={<MeetingsListPage />} />
  <Route path="/meetings/:meetingId" element={<MeetingDetailPage />} />
</Routes>
```

**Component Structure:**
- `client/src/pages/HomePage.jsx` - Dashboard, search, recent meetings
- `client/src/pages/MeetingsListPage.jsx` - Table of all meetings
- `client/src/pages/MeetingDetailPage.jsx` - Video player, transcript, summary
- `client/src/styles/*.css` - Page-specific styling

**Development Proxy:**
Vite proxies all API calls to Express (configured in `client/vite.config.js`):
- `/api/*` → http://localhost:3000
- `/search` → http://localhost:3000
- `/recordings/*` → http://localhost:3000
- `/meeting-summary/*` → http://localhost:3000

**Legacy Files:**
- `static/search.html` and `static/search.js` still exist for backwards compatibility
- Served at `/search` route (can be removed once migration is validated)

The `schema.ts` file defines the target data model for future database migration.

### API Endpoints

**React Frontend API** (New):
- `GET /api/meetings?limit=N`: List meetings (file-based, returns JSON array)
- `GET /api/meetings/:id`: Get specific meeting metadata
- Response format: `{ uuid, title, date, duration, hasSummary, hasVideo, hasTranscript }`

**Legacy/Existing**:
- `GET /search`: Serve legacy search page (backwards compatibility)
- `POST /search`: Query meetings via LLM (uses `query_prompt.md`)
- `GET /meeting-summary-files`: List available summaries
- `GET /meeting-summary/:fileName`: Get summary content
- `POST /webhook`: RTMS webhook receiver

**Static Asset Routes**:
- `/recordings/*`: Serves video/audio/transcript files
- `/static/*`: Legacy static files

**SPA Catch-All**:
- `GET *`: Serves React app (`client/dist/index.html`) for client-side routing
- **CRITICAL**: Must be defined LAST in Express middleware chain

**Future Endpoints** (see spec.md v1/v2):
- `GET /api/meetings/:id/transcript`: Get transcript segments from DB
- `POST /api/ai/chat`: SSE-based chat endpoint
- `GET /api/tasks`: Get action items

### LLM Integration

Two customizable prompts control AI behavior:

1. **summary_prompt.md**: Controls meeting summary generation
   - Placeholders: `{{raw_transcript}}`, `{{meeting_events}}`, `{{meeting_uuid}}`, `{{TODAYDATE}}`
   - Executed post-meeting via `chatWithOpenRouter()`

2. **query_prompt.md**: Controls search query responses
   - Placeholders: `{{meeting_summaries}}`, `{{query}}`
   - Uses `chatWithOpenRouterFast()` (no reasoning mode)

**Important**: These prompt files enable customization without code changes. Use XML tagging for structured outputs (recommended for Gemini models).

## Key Implementation Details

### RTMS Authentication

Signature generation (index.js:155-166):
```javascript
const message = `${CLIENT_ID},${meetingUuid},${streamId}`;
const signature = crypto.createHmac('sha256', CLIENT_SECRET).update(message).digest('hex');
```

Used in both signaling and media handshakes.

### Gap Filling Strategy

- **Audio**: Fills gaps ≥500ms with silent PCM frames (20ms each)
- **Video**: Inserts black H.264 frames for visual continuity
- Ensures playback sync even with network interruptions

### Active Connection Management

`activeConnections` Map tracks WebSocket lifecycle:
- Key: `meetingUuid`
- Value: `{ signaling: WebSocket, media: WebSocket, startTime: timestamp }`
- Cleaned up on `meeting.rtms_stopped` event

### Filename Sanitization

Use `sanitizeFileName()` for all file operations:
```javascript
function sanitizeFileName(name) {
  return name.replace(/[<>:"\/\\|?*=\s]/g, '_');
}
```

Prevents path traversal and filesystem errors.

## Development Workflow

### Adding New RTMS Message Types

1. Check Zoom's RTMS protocol docs for `msg_type` values
2. Add handler in `mediaWs.on('message')` (index.js:523+)
3. Create dedicated module (e.g., `saveRawSharescreen.js`) if complex
4. Update event logging in `recordings/{uuid}/events.log`

### Customizing AI Behavior

1. Edit `summary_prompt.md` or `query_prompt.md` directly
2. Test with a recorded meeting summary
3. Adjust XML tags or instructions as needed
4. No code changes or restarts required for prompt-only changes

### Working with React Frontend

**Development:**
1. Run backend: `node index.js` (port 3000)
2. Run Vite dev server: `cd client && npm run dev` (port 5173)
3. Visit http://localhost:5173 for HMR and fast refresh
4. Vite proxy automatically forwards API calls to backend

**Production:**
1. Build: `cd client && npm run build`
2. Run backend: `node index.js`
3. Visit http://localhost:3000 (serves built React app)

**Key Files:**
- `client/src/App.jsx` - React Router configuration
- `client/src/pages/*.jsx` - Page components
- `client/vite.config.js` - Dev proxy configuration
- `index.js` - Express serves `client/dist` for all non-API routes

**VTT Parsing:**
The transcript parsing logic is in `MeetingDetailPage.jsx`:
```javascript
const parseVTT = (vttText) => {
  // Returns array of { start, end, text }
  // Used for clickable transcript sidebar
}
```

**Video Sync:**
Clicking transcript lines jumps to video timestamp:
```javascript
const jumpToTime = (time) => {
  videoRef.current.currentTime = time
}
```

### Database Migration (Upcoming)

When implementing database (per spec.md):
1. Use TypeScript types from `schema.ts` as source of truth
2. Create migrations for tables: `meetings`, `speakers`, `transcript_segments`, `tasks`, etc.
3. Replace file-based storage in `recordings/` and `meeting_summary/`
4. Update post-meeting pipeline to write to DB instead of filesystem

## Common Issues

### FFmpeg Not Found

Media conversion (`convertMeetingMedia.js`) requires FFmpeg in PATH. Install via:
- macOS: `brew install ffmpeg`
- Ubuntu: `apt-get install ffmpeg`

### WebSocket Connection Failures

- Verify `ZOOM_CLIENT_ID` and `ZOOM_CLIENT_SECRET` are correct
- Check signature generation matches Zoom's expected format
- Ensure Zoom app has RTMS permissions enabled

### Missing Meeting Summaries

- Summaries generate async after meeting ends
- Check console logs for OpenRouter API errors
- Verify `OPENROUTER_API_KEY` is valid and has credits
- Ensure `summary_prompt.md` exists and is readable

## Zoom Marketplace Integration

- Set Zoom app URL to: `{domain}/search`
- Set webhook URL to: `{domain}/webhook` (matches `WEBHOOK_PATH`)
- Enable RTMS permissions in Zoom Marketplace app settings
- Use ngrok or similar for local development webhook testing

## Code Style Notes

- ES6 modules (`import`/`export`) throughout
- Async/await preferred over promise chains
- Console logging is verbose (useful for debugging RTMS streams)
- Security headers configured via Helmet middleware
- Static files served from both root and `client/dist`
