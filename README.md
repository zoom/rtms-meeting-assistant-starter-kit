# RTMS Meeting Assistant Starter Kit

This starter kit provides tools for assisting with Zoom meetings, including transcription, summarization, and chat functionality using OpenRouter.

### How It Works

1. **Recording via Zoom RTMS**: Utilizes Zoom's Real-Time Media Streams (RTMS) to capture raw transcript, video, and audio streams directly from Zoom meetings during active sessions
2. **Summary Processing via LLM**: Leverages the configured Large Language Model (LLM) to analyze transcripts and generate comprehensive meeting summaries with structured outputs including key decisions, action items, and entity detection
3. **Search via LLM**: Powers natural language querying across all meeting summaries using the LLM, enabling users to ask questions in plain English and receive contextual answers with meeting UUID references

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
└── static/
    ├── search.html             # Web interface for search/video/summaries
    └── search.js               # Frontend logic for search interface
recordings/                     # Generated meeting data storage
    └── {meetingUuid}/          # Per-meeting directory
        ├── transcript.(vtt|srt|txt)  # Real-time transcripts
        ├── event.logs           # Meeting event data (participant join/leave)
        ├── {userId}.raw         # Per-participant raw audio (gaps filled)
        ├── combined.h264        # Combined raw video with SPS/PPS headers
        └── final_output.mp4     # Final muxed video for playback
meeting_summary/                # LLM-generated meeting summaries
    └── {meetingUuid}.md        # Formatted meeting summary with structured content
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

- **Transcripts**: Saved as VTT, SRT, and TXT files in the `recordings/{meetingUuid}` folder with timestamped entries.
- **Audio**: Raw PCM data is stored per participant in `.raw` files within `recordings/{meetingUuid}/{userId}.raw`, with automatic gap filling for silent periods.
- **Video**: Raw H.264 video is combined into a single file `recordings/{meetingUuid}/combined.h264`, with SPS/PPS headers for playback compatibility and gap filling using black frames.

### Post-Meeting Processing
LLM summary generation from transcripts, event logs, and video/audio muxing operations occur only after the meeting concludes, ensuring comprehensive processing once all data is available. This includes combining raw audio and video streams into a final muxed video file (`recordings/{meetingUuid}/final_output.mp4`) for archival and playback.

## Customization

The application supports customization of AI behavior through prompt files:

- `summary_prompt.md`: Defines how meeting summaries are generated, including structured output for key decisions, action items, and entity detection. Users can modify this file to adjust the summarization logic without altering code.
- `query_prompt.md`: Specifies how the AI responds to user queries about meeting data, including XML tagging for meeting references. This allows users to customize query responses and output formatting.

These prompt files enable easy customization of AI behavior for different industries or user preferences without requiring code changes or recompilation.

## Usage

The application provides a web interface (`/search`) for interacting with meeting data:

- **Meeting Query**: Use natural language to search across meeting summaries, with results displayed in a structured format including references to specific meeting UUIDs.
- **Video Playback**: Select meetings by UUID to view synchronized video and transcript playback, with clickable transcript lines that jump to corresponding video timestamps.
- **Summary View**: Browse and display formatted meeting summaries stored in the system.

After setting up the API key and Zoom URL, you can run the application as per the scripts in `package.json`.

For more details, refer to the code and configuration files in the project.
