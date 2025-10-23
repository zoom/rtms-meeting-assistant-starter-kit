// meeting-assistant-schema.ts
// Types & helpers to power IDE autocomplete and keep app contracts consistent.

export type UUID = string & { readonly __brand: "uuid" };
export type ISODate = string & { readonly __brand: "iso-date" };
export type Millis = number & { readonly __brand: "ms" };
export type SeqNo = number & { readonly __brand: "seq" };

export enum MeetingStatus {
  Ongoing = "ongoing",
  Completed = "completed",
  Failed = "failed",
}

export enum TaskStatus {
  Draft = "draft",
  Confirmed = "confirmed",
  Done = "done",
}

export interface User {
  id: UUID;
  zoom_user_id?: string;
  email?: string;
  name?: string;
  avatar_url?: string;
  created_at: ISODate;
}

export interface Meeting {
  id: UUID;
  zoom_meeting_id?: string;
  title: string;
  start_time: ISODate;
  end_time?: ISODate;
  owner_user_id: UUID;
  status: MeetingStatus;
  language?: string;
  timezone?: string;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface Speaker {
  id: UUID;
  meeting_id: UUID;
  display_name?: string; // “Sarah M.”
  label?: string;        // “Speaker 1”
  zoom_participant_id?: string;
  role?: "host" | "participant" | "system";
}

export interface TranscriptSegment {
  id: UUID;
  meeting_id: UUID;
  speaker_id?: UUID;
  t_start_ms: Millis;
  t_end_ms: Millis;
  seq_no: SeqNo; // unique per meeting
  text: string;
  confidence?: number;
  created_at: ISODate;
}

export interface VTTFile {
  id: UUID;
  meeting_id: UUID;
  storage_key: string; // or object URL
  version: number;
  generated_at: ISODate;
}

export interface Highlight {
  id: UUID;
  meeting_id: UUID;
  user_id?: UUID;
  t_start_ms: Millis;
  t_end_ms: Millis;
  title: string;
  notes?: string;
  tags?: string[];
  created_at: ISODate;
}

export interface Task {
  id: UUID;
  meeting_id: UUID;
  owner_name?: string;
  owner_user_id?: UUID;
  description: string;
  due_date?: ISODate;
  status: TaskStatus;
  confidence?: number;
  source_meeting_id?: UUID;
  source_t_start_ms?: Millis;
  source_t_end_ms?: Millis;
}

export interface Embedding {
  id: UUID;
  meeting_id: UUID;
  segment_id: UUID;
  embedding: number[]; // dims depend on model
  norm_text?: string;
  metadata?: Record<string, unknown>;
}

export interface AICitation {
  meeting_id: UUID;
  segment_id?: UUID;
  t_start_ms: Millis;
  t_end_ms: Millis;
  confidence?: number;
  // Preformatted label “DevRel Sync 00:18:55–00:19:12”
  label?: string;
}

export interface AIMessage {
  id: UUID;
  session_id: UUID;
  role: "user" | "assistant" | "system";
  content: string; // markdown/plain; may include tool calls
  filters?: {
    date_from?: ISODate;
    date_to?: ISODate;
    meetings?: UUID[];
    speakers?: UUID[];
    tags?: string[];
  };
  citations?: AICitation[];
  created_at: ISODate;
}

export interface AISession {
  id: UUID;
  user_id: UUID;
  title?: string;
  created_at: ISODate;
}

export interface FeatureFlags {
  AI_ENABLED: boolean;
  EXTRACTION_ENABLED: boolean;
  PUBLIC_LINKS_ENABLED: boolean;
}

// -------------------- API Contracts (preview) --------------------

export namespace API {
  export interface ListMeetingsRequest {
    query?: string;
    from?: ISODate;
    to?: ISODate;
    limit?: number;
    cursor?: string;
  }
  export interface ListMeetingsResponse {
    items: Array<{
      id: UUID;
      title: string;
      start_time: ISODate;
      end_time?: ISODate;
      participants?: number;
      duration_ms?: Millis;
      status: MeetingStatus;
    }>;
    next_cursor?: string;
    request_id: string;
  }

  export interface GetMeetingResponse {
    meeting: Meeting;
    speakers: Speaker[];
    meta?: {
      participants_count?: number;
      duration_ms?: Millis;
    };
    request_id: string;
  }

  export interface ListTranscriptRequest {
    from_ms?: Millis;
    to_ms?: Millis;
    after_seq?: SeqNo;
    limit?: number;
  }
  export interface ListTranscriptResponse {
    segments: TranscriptSegment[];
    request_id: string;
  }

  export interface SearchRequest {
    q: string;
    meeting_id?: UUID;
    from?: ISODate;
    to?: ISODate;
    limit?: number;
  }
  export interface SearchHit {
    meeting_id: UUID;
    t_start_ms: Millis;
    snippet: string; // server-built snippet
    score?: number;
  }
  export interface SearchResponse {
    hits: SearchHit[];
    request_id: string;
  }

  export type ChatMode = "Summary" | "Structured";

  export interface ChatRequest {
    session_id?: UUID;
    message: string;
    filters?: {
      date_from?: ISODate;
      date_to?: ISODate;
      meetings?: UUID[];
      speakers?: UUID[];
      tags?: string[];
    };
    mode?: ChatMode;
  }
  export interface ChatChunk {
    type: "token" | "done" | "meta";
    token?: string;
    citations?: AICitation[];
  }

  export interface ListTasksRequest {
    date_range?: "yesterday" | "this_week" | "last_7d" | "custom";
    status?: TaskStatus;
    meeting_id?: UUID;
  }
  export interface ListTasksResponse {
    items: Task[];
    request_id: string;
  }
}

// -------------------- Helpers --------------------

export const msToTimestamp = (ms: Millis): string => {
  const total = Math.max(0, ms as number);
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const msRem = total % 1000;
  const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(msRem, 3)}`;
};

export const buildVttCue = (start: Millis, end: Millis, text: string) =>
  `${msToTimestamp(start)} --> ${msToTimestamp(end)}\n${text}\n\n`;

export const buildVtt = (segments: Pick<TranscriptSegment, "t_start_ms" | "t_end_ms" | "text">[]) => {
  const cues = segments
    .sort((a, b) => (a.t_start_ms as number) - (b.t_start_ms as number))
    .map(s => buildVttCue(s.t_start_ms, s.t_end_ms, s.text))
    .join("");
  return `WEBVTT\n\n${cues}`;
};

export const durationMs = (m: Meeting): Millis | undefined =>
  m.end_time ? ((new Date(m.end_time).getTime() - new Date(m.start_time).getTime()) as Millis) : undefined;

// -------------------- Mock Data (small) --------------------

export const MOCK_FLAGS: FeatureFlags = {
  AI_ENABLED: true,
  EXTRACTION_ENABLED: false,
  PUBLIC_LINKS_ENABLED: false,
};

export const MOCK_MEETINGS: Meeting[] = [
  {
    id: "abc-123" as UUID,
    zoom_meeting_id: "zoom-123",
    title: "DevRel Sync",
    start_time: "2025-10-18T09:00:00Z" as ISODate,
    end_time: "2025-10-18T09:42:00Z" as ISODate,
    owner_user_id: "user-1" as UUID,
    status: MeetingStatus.Completed,
    language: "en",
    timezone: "America/Los_Angeles",
    created_at: "2025-10-18T09:00:00Z" as ISODate,
    updated_at: "2025-10-18T10:00:00Z" as ISODate,
  },
];

export const MOCK_SPEAKERS: Speaker[] = [
  { id: "sp-1" as UUID, meeting_id: "abc-123" as UUID, display_name: "Host", role: "host" },
  { id: "sp-2" as UUID, meeting_id: "abc-123" as UUID, display_name: "Sarah", role: "participant" },
  { id: "sp-3" as UUID, meeting_id: "abc-123" as UUID, display_name: "John", role: "participant" },
];

export const MOCK_SEGMENTS: TranscriptSegment[] = [
  {
    id: "seg-1" as UUID,
    meeting_id: "abc-123" as UUID,
    speaker_id: "sp-1" as UUID,
    t_start_ms: 4000 as Millis,
    t_end_ms: 11000 as Millis,
    seq_no: 1 as SeqNo,
    text: "Welcome everyone…",
    created_at: "2025-10-18T09:00:05Z" as ISODate,
  },
  {
    id: "seg-2" as UUID,
    meeting_id: "abc-123" as UUID,
    speaker_id: "sp-2" as UUID,
    t_start_ms: 11000 as Millis,
    t_end_ms: 63000 as Millis,
    seq_no: 2 as SeqNo,
    text: "Sure, updates first…",
    created_at: "2025-10-18T09:00:12Z" as ISODate,
  },
];

export const MOCK_TASKS: Task[] = [
  {
    id: "task-1" as UUID,
    meeting_id: "abc-123" as UUID,
    owner_name: "Sarah",
    description: "Update docs outline",
    due_date: "2025-10-22T00:00:00Z" as ISODate,
    status: TaskStatus.Confirmed,
    source_meeting_id: "abc-123" as UUID,
    source_t_start_ms: 1320000 as Millis,
    source_t_end_ms: 1350000 as Millis,
  },
];

// -------------------- Route helpers --------------------

export const ROUTES = {
  index: "/",
  home: "/home",
  meetings: "/meetings",
  meetingDetail: (id: UUID) => `/meetings/${id}`,
  inMeeting: (id: UUID) => `/meeting/${id}`,
} as const;
