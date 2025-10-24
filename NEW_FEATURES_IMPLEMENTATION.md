# New Features Implementation Plan

## Summary of Changes Needed

The static/search.js has many new features that need to be ported to the React app:

### ✅ Completed
1. **WebSocket Hook** (`client/src/hooks/useWebSocket.js`) - Real-time communication
2. **LiveMeetingPage** (`client/src/pages/LiveMeetingPage.jsx`) - Live meeting view with:
   - Real-time transcript
   - Sentiment analysis
   - Dialog suggestions
   - Meeting summary
   - Query interface
3. **SentimentChart Component** (`client/src/components/SentimentChart.jsx`) - D3.js visualization

### 🚧 In Progress / TODO

#### 1. Speaker Timeline (D3.js visualization)

Create `client/src/components/SpeakerTimeline.jsx`:
- Horizontal bar chart showing who spoke when
- Clickable bars to jump to video timestamp
- Color-coded by speaker
- Moving time indicator synced with video

#### 2. Enhanced MeetingDetailPage

**Add:**
- Speaker timeline above transcript
- PDF viewer button (toggle inline iframe)
- Summary viewer button (toggle inline summary)
- Transcript auto-highlighting (current line highlights as video plays)
- Auto-scroll transcript to keep current line visible

#### 3. Meeting Topics/Titles System

**Backend already provides:**
- `GET /meeting-topics` - Maps topic → UUID

**Need to implement:**
- Load topics on app init
- Use topic names instead of UUIDs in dropdowns
- Show `"Topic Name (short-uuid...)"` format
- Cache topics in React context or state

#### 4. Update App.jsx Routes

Add route:
```javascript
<Route path="/meeting/:meetingId" element={<LiveMeetingPage />} />
```

Note: Different from `/meetings/:meetingId` (detail) vs `/meeting/:meetingId` (live)

#### 5. Update HomePage

**Add recent meetings with topics:**
- Fetch `/meeting-topics` on mount
- Display topic names instead of UUIDs
- Link to meeting detail page

#### 6. Update MeetingsListPage

**Add:**
- Load topics on mount
- Display topic names in table
- Search by topic name
- Sort by date (already done)

#### 7. Tab Navigation (Optional - from search.html)

The old search.html had tab navigation:
- Tab 1: Query/Search
- Tab 2: Video Playback
- Tab 3: Meeting Summary

**Decision:** We've split these into separate pages, which is better UX. Skip tab implementation.

## Implementation Steps

### Step 1: Add LiveMeetingPage route

```javascript
// client/src/App.jsx
import LiveMeetingPage from './pages/LiveMeetingPage'

// Add route
<Route path="/meeting/:meetingId" element={<LiveMeetingPage />} />
```

### Step 2: Create SpeakerTimeline Component

```javascript
// client/src/components/SpeakerTimeline.jsx
// - Parse VTT transcript
// - Extract speaker names from "Speaker Name: text"
// - Create D3 timeline chart
// - Add click handlers to jump video
// - Add time indicator line that moves with video
```

### Step 3: Enhance MeetingDetailPage

**Add state:**
```javascript
const [showPDF, setShowPDF] = useState(false)
const [showSummary, setShowSummary] = useState(false)
const [speakerTimelineData, setSpeakerTimelineData] = useState([])
```

**Add buttons:**
- "View Screen Share PDF" (if available)
- "View Summary" (if available)

**Add PDF viewer:**
```html
{showPDF && (
  <div className="pdf-viewer">
    <button onClick={() => setShowPDF(false)}>Close PDF</button>
    <iframe src={`/meeting-pdf/${encodeURIComponent(meetingId)}`} />
  </div>
)}
```

**Add transcript highlighting:**
```javascript
useEffect(() => {
  const videoElement = videoRef.current
  if (!videoElement) return

  const handleTimeUpdate = () => {
    const currentTime = videoElement.currentTime
    // Find transcript line matching current time
    // Highlight it and scroll into view
  }

  videoElement.addEventListener('timeupdate', handleTimeUpdate)
  return () => videoElement.removeEventListener('timeupdate', handleTimeUpdate)
}, [transcript])
```

### Step 4: Meeting Topics Context

**Create context:**
```javascript
// client/src/context/MeetingTopicsContext.jsx
import { createContext, useState, useEffect, useContext } from 'react'

const MeetingTopicsContext = createContext()

export function MeetingTopicsProvider({ children }) {
  const [topics, setTopics] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/meeting-topics')
      .then(res => res.json())
      .then(data => {
        setTopics(data) // { "Topic Name": "sanitized_uuid" }
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load topics:', err)
        setLoading(false)
      })
  }, [])

  const getTopicForUuid = (uuid) => {
    // Find topic where topics[topic] === uuid
    return Object.keys(topics).find(topic => topics[topic] === uuid)
  }

  const getDisplayName = (uuid) => {
    const topic = getTopicForUuid(uuid)
    const shortUuid = uuid.substring(0, 8)
    return topic ? `${topic} (${shortUuid}...)` : `Meeting ${shortUuid}...`
  }

  return (
    <MeetingTopicsContext.Provider value={{ topics, loading, getTopicForUuid, getDisplayName }}>
      {children}
    </MeetingTopicsContext.Provider>
  )
}

export const useMeetingTopics = () => useContext(MeetingTopicsContext)
```

**Wrap App:**
```javascript
// client/src/main.jsx
import { MeetingTopicsProvider } from './context/MeetingTopicsContext'

<MeetingTopicsProvider>
  <App />
</MeetingTopicsProvider>
```

### Step 5: Use Topics Throughout

**In HomePage:**
```javascript
const { getDisplayName } = useMeetingTopics()

{recentMeetings.map((meeting) => (
  <Link to={`/meetings/${meeting.uuid}`}>
    <div className="meeting-title">{getDisplayName(meeting.uuid)}</div>
  </Link>
))}
```

**In MeetingsListPage:**
```javascript
const { getDisplayName } = useMeetingTopics()

// In table
<div className="col-title">{getDisplayName(meeting.uuid)}</div>
```

**In MeetingDetailPage:**
```javascript
const { getDisplayName } = useMeetingTopics()

<h2>{getDisplayName(meetingId)}</h2>
```

### Step 6: CSS Files

**Create:**
- `client/src/styles/LiveMeetingPage.css`
- `client/src/styles/SpeakerTimeline.css`

**Update:**
- `client/src/styles/MeetingDetailPage.css` (add PDF viewer, summary overlay)

## Key Differences from search.js

### What We're Keeping
- ✅ Real-time WebSocket updates
- ✅ Sentiment analysis with D3 charts
- ✅ Dialog suggestions
- ✅ Live transcript
- ✅ Meeting query endpoint
- ✅ Speaker timeline
- ✅ PDF viewer
- ✅ Topic names for UUIDs

### What We're Changing
- ❌ No tab navigation (separate pages instead)
- ✅ React component structure
- ✅ Hooks for state management
- ✅ React Router for navigation
- ✅ Component reusability

### What We're Improving
- ✅ Better code organization
- ✅ Type safety (can add TypeScript later)
- ✅ Reusable components (SentimentChart, SpeakerTimeline)
- ✅ Context for shared state (topics)
- ✅ Better UX (separate pages vs tabs)

## Testing Checklist

Once implemented:

- [ ] Navigate to `/meeting/{uuid}` - LiveMeetingPage loads
- [ ] WebSocket connects and shows live status
- [ ] Real-time transcript updates appear
- [ ] Sentiment chart renders with data
- [ ] Dialog suggestions appear
- [ ] Meeting summary updates
- [ ] Query interface works
- [ ] Navigate to `/meetings/{uuid}` - MeetingDetailPage loads
- [ ] Speaker timeline renders above transcript
- [ ] Clicking timeline bar jumps video
- [ ] Video playback highlights current transcript line
- [ ] Transcript auto-scrolls with video
- [ ] PDF button shows (if PDF exists)
- [ ] PDF viewer opens in iframe
- [ ] Summary button shows (if summary exists)
- [ ] Summary displays inline
- [ ] Meeting topics load on app start
- [ ] Topic names display instead of UUIDs
- [ ] Search by topic name works

## Files to Create

1. ✅ `client/src/hooks/useWebSocket.js`
2. ✅ `client/src/pages/LiveMeetingPage.jsx`
3. ✅ `client/src/components/SentimentChart.jsx`
4. 🚧 `client/src/components/SpeakerTimeline.jsx`
5. 🚧 `client/src/context/MeetingTopicsContext.jsx`
6. 🚧 `client/src/styles/LiveMeetingPage.css`
7. 🚧 `client/src/styles/SpeakerTimeline.css`

## Files to Update

1. 🚧 `client/src/App.jsx` - Add LiveMeetingPage route
2. 🚧 `client/src/main.jsx` - Wrap with MeetingTopicsProvider
3. 🚧 `client/src/pages/MeetingDetailPage.jsx` - Add timeline, PDF, enhanced transcript
4. 🚧 `client/src/pages/HomePage.jsx` - Use topic names
5. 🚧 `client/src/pages/MeetingsListPage.jsx` - Use topic names
6. 🚧 `client/src/styles/MeetingDetailPage.css` - Add PDF/summary styles

## Next Steps

Run this in order:

1. Complete remaining components
2. Update all pages to use topics
3. Build and test
4. Update documentation

```bash
cd client
npm run build
cd ..
node index.js
```

Then test each feature against the checklist above.
