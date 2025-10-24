# Live Meeting Navigation - Implementation Guide

## Problem Solved

The app now provides clear navigation to live/active meetings and distinguishes between:
- **Live meetings** (ongoing Zoom meetings with active RTMS connections)
- **Recorded meetings** (completed meetings with saved recordings)

## Current Routing Strategy

### Two Distinct Routes

1. **`/meeting/:meetingId`** - Live Meeting View
   - Real-time WebSocket connection
   - Live transcript streaming
   - On-demand sentiment analysis
   - Dialog suggestions
   - Live meeting summary
   - Query interface

2. **`/meetings/:meetingId`** - Recorded Meeting Detail
   - Video playback
   - Speaker timeline
   - Full transcript
   - PDF viewer (if available)
   - Summary viewer (if available)

### Why Two Routes?

This separation provides:
- **Clear user intent**: Users know if they're joining a live meeting vs reviewing a recording
- **Different UI needs**: Live view focuses on real-time data; detail view focuses on playback
- **Performance**: Live view uses WebSocket; detail view uses static files
- **Future flexibility**: Can add Zoom Apps SDK to live view without affecting recordings

## How Users Access Live Meetings

### 1. HomePage (`/home`)

When a Zoom meeting with RTMS is active:
```
🔴 Live Meetings
┌────────────────────────────────────┐
│ [LIVE] Product Planning (a1b2c3...)│
│ Active meeting in progress         │
└────────────────────────────────────┘
```

**Features:**
- Red pulsing indicator (🔴)
- "LIVE" badge
- Auto-refreshes every 10 seconds
- Clicking navigates to `/meeting/:meetingId`

### 2. MeetingsListPage (`/meetings`)

Live meetings appear with visual indicators:
```
Title                    | Date       | Duration | Actions
─────────────────────────────────────────────────────────
[LIVE] Product Planning  | Today 2pm  | N/A      | [View Live]  ← Red button
Sprint Retrospective     | Jan 15     | 45m      | [View]       ← Blue button
```

**Features:**
- Pink background row
- "LIVE" badge
- Red "View Live" button (vs blue "View" for recordings)
- Auto-refreshes every 10 seconds

## Backend Implementation

### New API Endpoint

**GET `/api/live-meetings`**

Returns currently active meetings with RTMS connections:

```json
[
  {
    "uuid": "meeting-uuid-123",
    "hasSignaling": true,
    "hasMedia": true,
    "startTime": 1706198400000,
    "uptime": 1234567
  }
]
```

### How It Works

1. Backend tracks active meetings in `activeConnections` Map
2. When Zoom RTMS webhook sends `rtms.started`, WebSocket connections are established
3. `/api/live-meetings` endpoint checks which meetings have active signaling/media connections
4. Frontend polls this endpoint every 10 seconds
5. Live meetings appear in UI with special styling

## User Flow Example

### Starting a Live Meeting

1. User starts Zoom meeting with RTMS enabled
2. Webhook triggers: `rtms.started` → Backend opens WebSocket connections
3. User opens app homepage
4. Live Meetings section appears with pulsing red indicator
5. User clicks on live meeting
6. Navigates to `/meeting/:meetingId`
7. WebSocket connects, real-time transcript starts flowing

### During the Meeting

- Live transcript updates in real-time
- Dialog suggestions refresh every 15 seconds
- Meeting summary updates every 15 seconds
- User can click "Analyze Sentiment" for descriptive sentiment words
- User can ask questions about the current meeting

### After Meeting Ends

1. Zoom sends `rtms.stopped` webhook
2. Backend closes WebSocket connections
3. Media conversion starts (FFmpeg)
4. Meeting disappears from "Live Meetings" section
5. Recording appears in "Recent Meetings" (once processed)
6. Users access via `/meetings/:meetingId` for playback

## Zoom Apps SDK Integration (Future Enhancement)

### Current Limitation

The app is **web-based and external to Zoom**. Users must:
1. Open browser separately from Zoom
2. Manually navigate to the app
3. Find and click on their active meeting

### Recommended: Zoom Apps SDK

**Benefits of Integration:**

1. **In-Meeting Experience**
   - App appears as a sidebar/panel **inside** Zoom client
   - No need to switch windows
   - Always showing the current meeting (no navigation needed)

2. **Automatic Meeting Context**
   - Zoom Apps SDK provides meeting UUID automatically
   - No polling needed - you know which meeting user is in
   - Better security (Zoom handles auth)

3. **Better UX**
   - Participants see the same app interface
   - Collaborative features (shared notes, decisions)
   - Lower barrier to adoption

### Implementation Path

1. **Register as Zoom App**
   - Create app in Zoom Marketplace
   - Configure OAuth and scopes
   - Set up app manifest

2. **Add Zoom Apps SDK**
   ```bash
   npm install @zoom/appssdk
   ```

3. **Initialize in App**
   ```javascript
   import zoomSdk from "@zoom/appssdk"

   // Get meeting context
   const context = await zoomSdk.getMeetingContext()
   const meetingUuid = context.meetingUUID

   // Auto-navigate to live view
   navigate(`/meeting/${meetingUuid}`)
   ```

4. **Embed in Zoom**
   - App loads in iframe inside Zoom client
   - Remove manual navigation entirely
   - Always show current meeting

### Migration Strategy

**Phase 1: Current (External Web App)** ✅
- Users access via browser
- Manual navigation to live meetings
- Works with ngrok for development

**Phase 2: Hybrid (Both External + Zoom App)**
- Keep existing web app for flexibility
- Add Zoom Apps SDK integration
- Detect if running inside Zoom vs browser
- Route accordingly

**Phase 3: Zoom-Native (Recommended for Production)**
- Primary experience inside Zoom
- External web app for admins/reviewers
- Better adoption and engagement

## Code Reference

### Backend
- **index.js:747-769** - `/api/live-meetings` endpoint
- **index.js:70** - `activeConnections` Map
- **index.js:100-123** - `rtms.stopped` cleanup

### Frontend
- **HomePage.jsx:36-46** - Live meetings polling
- **HomePage.jsx:132-155** - Live Meetings UI section
- **MeetingsListPage.jsx:48-50** - `isLive()` helper
- **MeetingsListPage.jsx:114-122** - Conditional routing
- **App.jsx** - Routes definition

### Styling
- **HomePage.css:220-280** - Live meetings styles
- **MeetingsListPage.css:121-150** - Live indicators

## Summary

✅ **Implemented:**
- Live meeting detection via `/api/live-meetings`
- Prominent live meeting UI on homepage
- Visual indicators in meetings list
- Separate routes for live vs recorded
- Button-triggered sentiment analysis

🎯 **Next Steps:**
- Consider Zoom Apps SDK integration for better UX
- Add Zoom App manifest and OAuth
- Embed app inside Zoom client
- Eliminate manual navigation entirely

The current implementation provides a solid foundation. Zoom Apps SDK integration would elevate the user experience by removing friction and making the app instantly accessible during meetings.
