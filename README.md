# RTMS Meeting Assistant Starter Kit

This starter kit provides a quick way to get starter on Zoom RTMS + Zoom Apps, using transcription, summarization, and chat functionality using OpenRouter.

### How It Works

1. **Receive Media via Zoom RTMS**: Utilizes Zoom's Real-Time Media Streams (RTMS) to receive raw transcript, video, and audio streams directly from Zoom meetings during active sessions
2. **Summary Processing via LLM**: Leverages the configured Large Language Model (LLM) to analyze transcripts and generate comprehensive meeting summaries with structured outputs including key decisions, action items, and entity detection
3. **Search via LLM**: Natural language querying across all meeting summaries using the LLM, enabling users to ask questions in plain English and receive contextual answers with streamid references


### File Structure & Purpose

```
project/
├── .env                        # API keys & config
├── summary_prompt.md           # LLM instructions for summarization
├── query_prompt.md             # LLM instructions for search queries
├── black_frame.h264            # Black frame template for video gap filling
├── sps_pps_keyframe.h264       # H.264 video headers for stream compatibility
├── index.js                    # Main RTMS application server & recording logic
├── muxFirstAudioVideo.js       # Initial audio/video muxing for combined streams
├── saveRawAudioAdvance.js      # Real-time audio stream saving 
├── saveRawVideoAdvance.js      # Real-time video stream saving
├── writeTranscriptToVtt.js     # Real-time transcript writing in multiple formats
├── convertMeetingMedia.js      # FFmpeg conversion utilities
├── chatWithOpenrouter.js       # LLM API integration for chat & summarization
├── saveSharescreen.js          # Real-time screenshare capture, frame deduplication, and PDF generation
├── tool.js                     # Utility functions including filename sanitization
└── static/
    ├── search.html             # Web interface for search/video/summaries
    └── search.js               # Frontend logic for search interface
recordings/                     # Generated meeting data storage
    └── {streamId}/          # Per-meeting directory
        ├── transcript.(vtt|srt|txt)  # Real-time transcripts
        ├── event.logs           # Meeting event data (participant join/leave)
        ├── {userId}.raw         # Per-participant raw audio (gaps filled)
        ├── combined.h264        # Combined raw video with SPS/PPS headers
        ├── final_output.mp4     # Final muxed video for playback
        └── processed/           # Sharescreen processing directory
            ├── jpg/             # Individual captured JPEG frames
            └── approved.pdf     # Compiled sharescreen PDF
meeting_summary/                # LLM-generated meeting summaries
    └── {streamId}.md        # Formatted meeting summary with structured content
```

## Setup Instructions

### OpenRouter API Key

To enable chat and AI-powered features, you will need an API key from OpenRouter.

1. Visit [OpenRouter](https://openrouter.ai/) and sign up for an account.
2. Generate an API key from your OpenRouter dashboard.
3. Create a `.env` file in the project root and add your API key and model:
   ```
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   OPENROUTER_MODEL=google/gemini-2.5-pro
   OPENROUTER_REASONING_ENABLED="true"

   # Zoom configuration
   ZOOM_CLIENT_ID=your_zoom_client_id_here
   ZOOM_CLIENT_SECRET=your_zoom_client_secret_here
   ZOOM_SECRET_TOKEN=your_zoom_secret_token_here

   # Server configuration
   PORT=3000
   WEBHOOK_PATH="/webhook"
   WEBSOCKET_URL="rtms.asdc.cc/client-websocket"
   ```
4. Use a modern LLM that supports XML tagging, such as Google Gemini 2.5 Pro, as specified in the .env.example file. The `OPENROUTER_REASONING_ENABLED` setting controls whether the AI uses its reasoning capabilities for processing meeting data, which can improve structured outputs and analysis.
5. Make sure to keep your API key secure and never commit it to version control.

### Zoom Marketplace Configuration

To integrate this application with Zoom, add it to the Zoom Marketplace or configure your Zoom app as follows:

- Set the Zoom app URL to `{domain}/search`, replacing `{domain}` with your actual domain (e.g., `https://yourdomain.com/search`).
- Set the webhook URL to `{domain}/webhook` (as configured by `WEBHOOK_PATH="/webhook"` in your `.env` file) to match the setup on [marketplace.zoom.us](https://marketplace.zoom.us).

Ensure your application is accessible at these endpoints to handle Zoom requests.

## Features

### Real-Time Recording
During active meetings, the application saves transcript, video, and audio data to disk in real time for immediate access and processing.

- **Transcripts**: Saved as VTT, SRT, and TXT files in the `recordings/{streamId}` folder with timestamped entries.
- **Audio**: Raw PCM data is stored per participant in `.raw` files within `recordings/{streamId}/{userId}.raw`, with automatic gap filling for silent periods.
- **Video**: Raw H.264 video is combined into a single file `recordings/{streamId}/combined.h264`, with SPS/PPS headers for playback compatibility and gap filling using black frames.

### Post-Meeting Processing
LLM summary generation from transcripts, event logs, and video/audio muxing operations occur only after the meeting concludes, ensuring comprehensive processing once all data is available. This includes combining raw audio and video streams into a final muxed video file (`recordings/{streamId}/final_output.mp4`) for archival and playback.

### Data Storage and Reuse
All meeting data is stored in a structured format within the `recordings/{streamId}/` directory, enabling users to leverage this rich dataset for custom AI training and analysis:

- **Transcripts**: Available in multiple formats (VTT, SRT, TXT) for natural language processing tasks
- **Audio**: Raw PCM data per participant in `.raw` files, suitable for speech recognition training
- **Video**: Raw H.264 streams and final muxed MP4 files for computer vision applications
- **Sharescreen Media**: Captured screenshots  (in `/processed`) saved as JPEG files, along with generated PDF compilations, perfect for document analysis and visual content training
- **Event Logs**: Structured logs of meeting events (participant join/leave) that can be used for analyzing meeting participation patterns

This comprehensive media library allows developers to fine-tune AI models on their own meeting data, improving accuracy for industry-specific terminology, speaker recognition, and content analysis.

## Customization

The application supports customization of AI behavior through prompt files:

- `summary_prompt.md`: Defines how meeting summaries are generated, including structured output for key decisions, action items, and entity detection. Users can modify this file to adjust the summarization logic without altering code.
- `query_prompt.md`: Specifies how the AI responds to user queries about meeting data, including XML tagging for meeting references. This allows users to customize query responses and output formatting.
- `query_prompt_current_meeting.md`: Controls AI analysis of current ongoing meetings, allowing users to query real-time transcript data for insights about active conversations and participant activity.
- `query_prompt_dialog_suggestions.md`: Enables the AI to generate strategic conversation directions for meeting facilitation, providing 4 actionable suggestions for guiding discussions like RPG quest options.
- `query_prompt_sentiment_analysis.md`: Performs detailed sentiment analysis of all meeting participants, scoring each user's positive, neutral, and negative sentiment indicators from their speech patterns.

These prompt files enable easy customization of AI behavior for different industries or user preferences without requiring code changes or recompilation.

## Usage

The application provides a web interface (`/search`) for interacting with meeting data:


- **Search and Playback**: Select meetings by stream id to view synchronized video and transcript playback, with clickable transcript lines that jump to corresponding video timestamps.
- **View All Summaries**: Browse and display formatted meeting summaries stored in the system.
- **Real-time Dashboard**: Use natural language to interact with current meetings, display AI dialog suggestions, sentiment analysis and real-time summarization.

After setting up the API key and Zoom URL, you can run the application as per the scripts in `package.json`.

For more details, refer to the code and configuration files in the project.

## API & Integration

### REST API Endpoints

The application provides several REST API endpoints designed for Zoom Apps integration:

- `GET /search` - Serves the main web interface for meeting search and playback
- `GET /api/config` - Returns configuration data including WebSocket URL and list of available meetings for client initialization
- `POST /api/meeting-query` - Handles AI-powered queries about current meeting transcripts using natural language
- `POST /search` - Processes queries across historical meeting summaries and returns structured responses with stream ID references
- `GET /meeting-summary-files` - Returns a list of all available meeting summary files
- `GET /meeting-summary/:fileName` - Serves the content of a specific meeting summary file
- `GET /meeting-pdf/:streamId` - Serves compiled screen share PDF files for specific meetings
- `GET /meeting-topics` - Provides a mapping of meeting topics to their corresponding stream IDs

### WebSocket Server

The server includes a WebSocket implementation specifically designed for Zoom Apps to establish real-time connections:

- Enables Zoom Apps to receive live transcript updates as they occur during meetings
- Broadcasts real-time AI processing results including sentiment analysis, dialog suggestions, and meeting summaries
- Provides connection status monitoring for reliable real-time data delivery
- Supports multiple simultaneous Zoom Apps connections per meeting for collaborative features

### Security Headers

Comprehensive security headers are implemented using Helmet.js middleware to meet Zoom Apps requirements:

- **Content Security Policy (CSP)** - Prevents XSS attacks and restricts resource loading to approved sources
- **Strict-Transport-Security (HSTS)** - Enforces HTTPS connections and prevents protocol downgrade attacks
- **X-Content-Type-Options: nosniff** - Prevents MIME type sniffing vulnerabilities
- **Referrer-Policy** - Controls referrer information sent with requests
- **Security Middleware** - Additional protections via Helmet.js against common web vulnerabilities

### Zoom Apps Integration Requirements

**Important**: When deploying this application for use within Zoom meeting client's app tab, developers must ensure compliance with Zoom's current security and integration requirements. Always refer to the latest [Zoom Apps documentation](https://marketplace.zoom.us/docs/) for:

- Updated security header requirements and CSP policies
- WebSocket connection protocols and authentication methods
- API endpoint specifications and rate limiting guidelines
- Content embedding and iframe restrictions within Zoom clients

Zoom regularly updates their security policies, so please verify your implementation against the most current documentation before deploying to production.
Zoom regularly updates their security policies, so please verify your implementation against the most current documentation before deploying to production.
