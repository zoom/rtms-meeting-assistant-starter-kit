# Meeting Assistant Starter Kit — App Spec

Single source of truth for routes, UX, data, and APIs. Point your IDE/codegen at this doc for autocomplete context.

---

## 1) Routes & App Structure

| Route | Purpose |
|---|---|
| `/` | Landing & authorization (Sign in with Zoom / Google). |
| `/home` | **Dashboard + Chat** (“Chat with your Notetaker”). Highlights this week, reminders from yesterday, suggested prompts, link to meetings. |
| `/meetings` | **Meetings list** (title + date first-class; not UUIDs). Filter/sort/search. |
| `/meetings/[meetingID]` | **Meeting detail / playback**: summary, transcript/timeline, video, participants, highlights/tasks. |
| `/meeting/{currentMeetingUUID}` | **In-meeting** (live transcript, notes, actions, risk signals). |

---

## 2) Home (`/home`)

- Chat with Notetaker (RAG over transcripts; citations → jump to meeting/time).
- Highlights from this week.
- Reminders / takeaways from yesterday.
- Suggested prompts:
  - What did I commit to this week?
  - Decisions made last meeting?
  - Action items from yesterday?
- Link to “View My Meetings”.
- Empty state: “No meetings yet — connect your Zoom account.”

**Data**
- `GET /api/meetings?limit=5`
- `GET /api/search`
- `POST /api/ai/chat`
- `GET /api/tasks?date_range=yesterday`

---

## 3) Meetings List (`/meetings`)

- Table or cards: Title, Date, Duration, Participants, Open.
- Filters (date range, tags). Search box.
- Empty state when none exist.

**Data**
- `GET /api/meetings` (title & date are primary; IDs secondary)
- Derived: `duration`, `participants_count`

---

## 4) Meeting Detail (`/meetings/[meetingID]`)

Sections:
1. **Summary**: description/AI summary; mini “Ask about this meeting” chat.
2. **Transcript / Timeline**: scrollable, speaker labels, timestamps, jump to hits, follow-live (if active).
3. **Recording**: video player (v2), optional active speaker overlay.
4. **Participants**: attendance & speaking duration. “Active speaker switch.”
5. **Highlights & Tasks**: takeaways; table `Owner | Task | Due | Source (timestamp)`.

**Data**
- `GET /api/meetings/:id`
- `GET /api/meetings/:id/transcript`
- `GET /api/meetings/:id/vtt`
- `GET /api/tasks?meeting_id=`
- `POST /api/ai/chat` (inline Q&A)
- (v2) video URL from Zoom/Supabase

---

## 5) In-Meeting (`/meeting/{currentMeetingUUID}`)

- **Transcript/Timeline**: live RTMS stream (≤1s P95). Scroll-up detaches follow-live.
- **Notes & Takeaways**: real-time draft notes; confirm/assign action items with owners.
- **Suggestions (real time)**: assistant nudges to clarify, summarize, or capture commitments.
- **Risk assessments** (optional): domain flags (finserv, lending, medical, legal).

> “Not a recorder—an assistant. Make me look smarter and faster. Real-time augmentation > post-hoc.”

---

## 6) Version Roadmap

- **v0.5**: Ask about transcript; list meetings; meeting detail; in-meeting live transcript.
- **v1**: Store meeting transcripts in DB; full-text search.
- **v2**: Store recordings; video replay (Fathom-style).

---

## 7) Minimal Data Model

- `meetings`: id, title, start_time, end_time, owner_user_id, status, language, timezone
- `speakers`: id, meeting_id, display_name, role
- `transcript_segments`: id, meeting_id, speaker_id, t_start_ms, t_end_ms, text, seq_no
- `vtt_files`: id, meeting_id, storage_key, version
- `highlights`: id, meeting_id, t_start_ms, t_end_ms, title, notes
- `tasks`: id, meeting_id, owner_name, description, due_date, status, source_timestamps

---

## 8) API (Preview)

- `GET /api/meetings`
- `GET /api/meetings/:id`
- `GET /api/meetings/:id/transcript?from_ms&to_ms&limit&after_seq`
- `GET /api/meetings/:id/vtt`
- `GET /api/search?q&meeting_id&from&to`
- `POST /api/ai/chat` (SSE)
- `GET /api/tasks?date_range&status&meeting_id`

---

## 9) Design Intent

- Neutral, forkable UI (gray base with blue/purple accent).
- Dual-mode support (light/dark).
- Emphasis on clarity, developer readability, and extensibility.

---

_Last updated: {{ auto_date }}_
