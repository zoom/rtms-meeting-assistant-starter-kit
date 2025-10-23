import express from 'express';
import crypto from 'crypto';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

import { saveRawAudio as saveRawAudioAdvance } from './saveRawAudioAdvance.js';
import { saveRawVideo as saveRawVideoAdvance } from './saveRawVideoAdvance.js';
import { writeTranscriptToVtt } from './writeTranscriptToVtt.js';
import { chatWithOpenRouter,chatWithOpenRouterFast } from './chatWithOpenrouter.js';
import { convertMeetingMedia } from './convertMeetingMedia.js';
import { muxFirstAudioVideo } from './muxFirstAudioVideo.js';


// Load environment variables from a .env file
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const port = process.env.PORT || 3000;
const execAsync = promisify(exec);

// Function to sanitize filename to avoid invalid characters
function sanitizeFileName(name) {
  return name.replace(/[<>:"\/\\|?*=\s]/g, '_');
}

const ZOOM_SECRET_TOKEN = process.env.ZOOM_SECRET_TOKEN;
const CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/webhook';


// Middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (HTML, JS, etc.)
app.use(express.static(__dirname));


app.use(helmet());

app.use((req, res, next) => {
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none';"
  );
  next();
});

// Map to keep track of active WebSocket connections and audio chunks
const activeConnections = new Map();


// Handle POST requests to the webhook endpoint
app.post(WEBHOOK_PATH, async (req, res) => {
  // Respond with HTTP 200 status
  res.sendStatus(200);
  console.log('RTMS Webhook received:', JSON.stringify(req.body, null, 2));
  const { event, payload } = req.body;

  // Handle URL validation event
  if (event === 'endpoint.url_validation' && payload?.plainToken) {
    // Generate a hash for URL validation using the plainToken and a secret token
    const hash = crypto
      .createHmac('sha256', ZOOM_SECRET_TOKEN)
      .update(payload.plainToken)
      .digest('hex');
    console.log('Responding to URL validation challenge');
    return res.json({
      plainToken: payload.plainToken,
      encryptedToken: hash,
    });
  }

  // Handle RTMS started event
  if (event === 'meeting.rtms_started') {
    console.log('RTMS Started event received');
    const { meeting_uuid, rtms_stream_id, server_urls } = payload;
    // Initiate connection to the signaling WebSocket server
    connectToSignalingWebSocket(meeting_uuid, rtms_stream_id, server_urls);
  }

  // Handle RTMS stopped event
  if (event === 'meeting.rtms_stopped') {
    console.log('RTMS Stopped event received');
    const { meeting_uuid } = payload;

    // Close all active WebSocket connections for the given meeting UUID
    if (activeConnections.has(meeting_uuid)) {
      const connections = activeConnections.get(meeting_uuid);
      console.log('Closing active connections for meeting: ' + meeting_uuid);
      for (const conn of Object.values(connections)) {
        if (conn && typeof conn.close === 'function') {
          conn.close();
        }
      }
      activeConnections.delete(meeting_uuid);
    }

    console.log('Starting media conversion for meeting: ' + meeting_uuid);
    await convertMeetingMedia(meeting_uuid); // Old method (gap-filled, converts individually)
    console.log('Starting audio-video multiplexing for meeting: ' + meeting_uuid);
    await muxFirstAudioVideo(meeting_uuid); // Mux the old conversions

    // Generate meeting summary using OpenRouter
    (async () => {
      const safeMeetingUuid = sanitizeFileName(meeting_uuid);
      console.log('Starting summary generation for meeting: ' + meeting_uuid);
      try {
        const promptTemplate = fs.readFileSync('summary_prompt.md', 'utf-8');
        const eventsLog = fs.existsSync(`recordings/${safeMeetingUuid}/events.log`) ? fs.readFileSync(`recordings/${safeMeetingUuid}/events.log`, 'utf-8') : '';
        const transcriptVtt = fs.existsSync(`recordings/${safeMeetingUuid}/transcript.vtt`) ? fs.readFileSync(`recordings/${safeMeetingUuid}/transcript.vtt`, 'utf-8') : '';
        const todayDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const filledPrompt = promptTemplate
          .replace(/\{\{raw_transcript\}\}/g, transcriptVtt)
          .replace(/\{\{meeting_events\}\}/g, eventsLog)
          .replace(/\{\{meeting_uuid\}\}/g, meeting_uuid)
          .replace(/\{\{TODAYDATE\}\}/g, todayDate);
        const summary = await chatWithOpenRouter(filledPrompt);
        fs.mkdirSync('meeting_summary', { recursive: true });
        fs.writeFileSync(`meeting_summary/${safeMeetingUuid}.md`, summary);
        console.log(`✅ Summary generated and saved for meeting ${meeting_uuid} at meeting_summary/${safeMeetingUuid}.md`);
      } catch (error) {
        console.error('❌ Error generating summary:', error.message);
      }
    })();
  }
});

// Function to generate a signature for authentication
function generateSignature(CLIENT_ID, meetingUuid, streamId, CLIENT_SECRET) {
  console.log('Generating signature with parameters:');
  console.log('meetingUuid:', meetingUuid);
  console.log('streamId:', streamId);
  console.log('CLIENT_ID:', CLIENT_ID);

  // Create a message string and generate an HMAC SHA256 signature
  const message = `${CLIENT_ID},${meetingUuid},${streamId}`;
  const signature = crypto.createHmac('sha256', CLIENT_SECRET).update(message).digest('hex');
  console.log('Generated signature:', signature);
  return signature;
}

// Function to connect to the signaling WebSocket server
function connectToSignalingWebSocket(meetingUuid, streamId, serverUrl) {
  console.log(`Connecting to signaling WebSocket for meeting ${meetingUuid}`);
  console.log('Stream ID:', streamId);
  console.log('Server URL:', serverUrl);

  const safeMeetingUuid = sanitizeFileName(meetingUuid);
  console.log('Sanitized Meeting UUID:', safeMeetingUuid);

  const ws = new WebSocket(serverUrl);
  console.log('WebSocket created successfully');

  // Store connection for cleanup later
  if (!activeConnections.has(meetingUuid)) {
    activeConnections.set(meetingUuid, {});
  }
  activeConnections.get(meetingUuid).signaling = ws;
  activeConnections.get(meetingUuid).startTime = Date.now();
  console.log('Signaling connection stored for cleanup');


  // Function to format timestamp to VTT format (HH:MM:SS.mmm)
  function formatVTTTime(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }

  // Event type map for verbose names
  const eventTypeNames = {
    2: 'active_speaker_changed',
    3: 'participant_joined',
    4: 'participant_left'
  };

  ws.on('open', () => {
    console.log(`Signaling WebSocket connection opened for meeting ${meetingUuid}`);
    const signature = generateSignature(
      CLIENT_ID,
      meetingUuid,
      streamId,
      CLIENT_SECRET
    );

    // Send handshake message to the signaling server
    const handshake = {
      msg_type: 1, // SIGNALING_HAND_SHAKE_REQ
      protocol_version: 1,
      meeting_uuid: meetingUuid,
      rtms_stream_id: streamId,
      sequence: Math.floor(Math.random() * 1e9),
      signature,
    };
    ws.send(JSON.stringify(handshake));
    console.log('Sent handshake to signaling server');
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    console.log('Signaling Message:', JSON.stringify(msg, null, 2));

    // Handle successful handshake response
    if (msg.msg_type === 2 && msg.status_code === 0) { // SIGNALING_HAND_SHAKE_RESP
      const mediaUrl = msg.media_server?.server_urls?.all;
      if (mediaUrl) {
        // Connect to the media WebSocket server using the media URL
        connectToMediaWebSocket(mediaUrl, meetingUuid, safeMeetingUuid, streamId, ws);
      }

      //subscribe to events 
      const payload = {
        msg_type: 5,
        events: [
          { event_type: 2, subscribe: true },
          { event_type: 3, subscribe: true },
          { event_type: 4, subscribe: true }
        ]
      };
      ws.send(JSON.stringify(payload));
      console.log('[SUCCESS] Event Subscription Payload sent:', JSON.stringify(payload, null, 2));
    }

    if (msg.msg_type === 6) {
      console.log("Event Subscription Received.");

      switch (msg.event.event_type) {
        case 1:
          console.log("Event: First packet capture timestamp received.");
          break;
        case 2:
          console.log("Event: Active speaker has changed.");
          const eventData2 = { ...msg.event, event_type: eventTypeNames[msg.event.event_type] };
          fs.mkdirSync(`recordings/${safeMeetingUuid}`, { recursive: true });
          fs.appendFileSync(`recordings/${safeMeetingUuid}/events.log`, JSON.stringify({ timestamp: formatVTTTime(Date.now() - activeConnections.get(meetingUuid).startTime), event: eventData2 }) + '\n');
          break;
        case 3:
          console.log("Event: Participant joined.");
          const eventData3 = { ...msg.event, event_type: eventTypeNames[msg.event.event_type] };
          fs.mkdirSync(`recordings/${safeMeetingUuid}`, { recursive: true });
          fs.appendFileSync(`recordings/${safeMeetingUuid}/events.log`, JSON.stringify({ timestamp: formatVTTTime(Date.now() - activeConnections.get(meetingUuid).startTime), event: eventData3 }) + '\n');
          break;
        case 4:
          console.log("Event: Participant left.");
          const eventData4 = { ...msg.event, event_type: eventTypeNames[msg.event.event_type] };
          fs.mkdirSync(`recordings/${safeMeetingUuid}`, { recursive: true });
          fs.appendFileSync(`recordings/${safeMeetingUuid}/events.log`, JSON.stringify({ timestamp: formatVTTTime(Date.now() - activeConnections.get(meetingUuid).startTime), event: eventData4 }) + '\n');
          break;
        default:
          console.log("Event: Unknown event type.");
      }
    }

    if (msg.msg_type === 8) {
      console.log("Stream Update Received.");

      switch (msg.state) {
        case 0:
          console.log("Stream State: Inactive.");
          break;
        case 1:
          console.log("Stream State: Active.");
          break;
        case 2:
          console.log("Stream State: Interrupted.");
          break;
        case 3:
        case 4:
          console.log("Stream State: Terminating.");
          break;
        default:
          console.log("Stream State: Unknown state.");
      }

      switch (msg.stop_reason) {
        case 1:
          console.log("Stopped because the host triggered it.");
          break;
        case 2:
          console.log("Stopped because the user triggered it.");
          break;
        case 3:
          console.log("Stopped because the user left.");
          break;
        case 4:
          console.log("Stopped because the user was ejected.");
          break;
        case 5:
          console.log("Stopped because the app was disabled by the host.");
          break;
        case 6:
          console.log("Stopped because the meeting ended.");
          break;
        case 7:
          console.log("Stopped because the stream was canceled.");
          break;
        case 8:
          console.log("Stopped because the stream was revoked.");
          break;
        case 9:
          console.log("Stopped because all apps were disabled.");
          break;
        case 10:
          console.log("Stopped due to an internal exception.");
          break;
        case 11:
          console.log("Stopped because the connection timed out.");
          break;
        case 12:
          console.log("Stopped due to meeting connection interruption.");
          break;
        case 13:
          console.log("Stopped because the signaling connection was interrupted.");
          break;
        case 14:
          console.log("Stopped because the data connection was interrupted.");
          break;
        case 15:
          console.log("Stopped because the signaling connection closed abnormally.");
          break;
        case 16:
          console.log("Stopped because the data connection closed abnormally.");
          break;
        case 17:
          console.log("Stopped due to receiving an exit signal.");
          break;
        case 18:
          console.log("Stopped due to an authentication failure.");
          break;
        default:
          console.log("Stopped for an unknown reason.");
      }
    }

    if (msg.msg_type === 9) {
      console.log("Session State Update Received.");

      switch (msg.state) {
        case 2:
          console.log("Session State: Started.");
          break;
        case 3:
          console.log("Session State: Paused.");
          break;
        case 4:
          console.log("Session State: Resumed.");
          break;
        case 5:
          console.log("Session State: Stopped.");
          break;
        default:
          console.log("Session State: Unknown state.");
      }

      switch (msg.stop_reason) {
        case 1:
          console.log("Stopped because the host triggered it.");
          break;
        case 2:
          console.log("Stopped because the user triggered it.");
          break;
        case 3:
          console.log("Stopped because the user left.");
          break;
        case 4:
          console.log("Stopped because the user was ejected.");
          break;
        case 5:
          console.log("Stopped because the app was disabled by the host.");
          break;
        case 6:
          console.log("Stopped because the meeting ended.");
          break;
        case 7:
          console.log("Stopped because the stream was canceled.");
          break;
        case 8:
          console.log("Stopped because the stream was revoked.");
          break;
        case 9:
          console.log("Stopped because all apps were disabled.");
          break;
        case 10:
          console.log("Stopped due to an internal exception.");
          break;
        case 11:
          console.log("Stopped because the connection timed out.");
          break;
        case 12:
          console.log("Stopped due to meeting connection interruption.");
          break;
        case 13:
          console.log("Stopped because the signaling connection was interrupted.");
          break;
        case 14:
          console.log("Stopped because the data connection was interrupted.");
          break;
        case 15:
          console.log("Stopped because the signaling connection closed abnormally.");
          break;
        case 16:
          console.log("Stopped because the data connection closed abnormally.");
          break;
        case 17:
          console.log("Stopped due to receiving an exit signal.");
          break;
        case 18:
          console.log("Stopped due to an authentication failure.");
          break;
        default:
          console.log("Stopped for an unknown reason.");
      }
    }
    // Respond to keep-alive requests
    if (msg.msg_type === 12) { // KEEP_ALIVE_REQ
      const keepAliveResponse = {
        msg_type: 13, // KEEP_ALIVE_RESP
        timestamp: msg.timestamp,
      };
      console.log('Responding to Signaling KEEP_ALIVE_REQ:', keepAliveResponse);
      ws.send(JSON.stringify(keepAliveResponse));
    }
  });

  ws.on('error', (err) => {
    console.error('Signaling socket error:', err);
  });

  ws.on('close', () => {
    console.log('Signaling socket closed');
    if (activeConnections.has(meetingUuid)) {
      delete activeConnections.get(meetingUuid).signaling;
    }
  });
}

// Function to connect to the media WebSocket server
function connectToMediaWebSocket(mediaUrl, meetingUuid, safeMeetingUuid, streamId, signalingSocket) {
  console.log(`Connecting to media WebSocket at ${mediaUrl}`);

  const mediaWs = new WebSocket(mediaUrl, { rejectUnauthorized: false });

  // Store connection for cleanup later
  if (activeConnections.has(meetingUuid)) {
    activeConnections.get(meetingUuid).media = mediaWs;
  }



  mediaWs.on('open', () => {
    const signature = generateSignature(
      CLIENT_ID,
      meetingUuid,
      streamId,
      CLIENT_SECRET
    );
    const handshake = {
      msg_type: 3, // DATA_HAND_SHAKE_REQ
      protocol_version: 1,
      meeting_uuid: meetingUuid,
      rtms_stream_id: streamId,
      signature,
      media_type: 32, // AUDIO+VIDEO+TRANSCRIPT
      payload_encryption: false,
      media_params: {
        audio: {
          content_type: 1,
          sample_rate: 1,
          channel: 1,
          codec: 1,
          data_opt: 1,
          send_rate: 100
        },
        video: {
          codec: 7, //H264
          resolution: 2,
          fps: 25
        },
        deskshare: {
          codec: 5, //JPG,
          resolution: 2, //720p
          fps: 1
        },
        chat: {
          content_type: 5, //TEXT
        },
        transcript: {
          content_type: 5 //TEXT
        }
      }
    };
    mediaWs.send(JSON.stringify(handshake));
  });

  mediaWs.on('message', (data) => {
    try {
      // Try to parse as JSON first
      const msg = JSON.parse(data.toString());
      //console.log('Media JSON Message:', JSON.stringify(msg, null, 2));

      // Handle successful media handshake
      if (msg.msg_type === 4 && msg.status_code === 0) { // DATA_HAND_SHAKE_RESP
        signalingSocket.send(
          JSON.stringify({
            msg_type: 7, // CLIENT_READY_ACK
            rtms_stream_id: streamId,
          })
        );
        console.log('Media handshake successful, sent start streaming request');
      }

      // Respond to keep-alive requests
      if (msg.msg_type === 12) { // KEEP_ALIVE_REQ
        mediaWs.send(
          JSON.stringify({
            msg_type: 13, // KEEP_ALIVE_RESP
            timestamp: msg.timestamp,
          })
        );
        console.log('Responded to Media KEEP_ALIVE_REQ');
      }

      // Handle audio data
      if (msg.msg_type === 14 && msg.content && msg.content.data) {

        let { user_id, user_name, data: audioData, timestamp } = msg.content;
        if (user_id == null || !meetingUuid) {
          console.error('Missing metadata: cannot save audio');
          return;
        }

        let buffer = Buffer.from(audioData, 'base64');
        //console.log(`Processing audio data for user ${user_name} (ID: ${user_id}), buffer size: ${buffer.length} bytes`);
        saveRawAudioAdvance(buffer, meetingUuid, user_id, Date.now()); // Primary method

      }
      // Handle video data
      if (msg.msg_type === 15 && msg.content && msg.content.data) {
        let epochMilliseconds = Date.now();
        let { user_id, user_name, data: videoData, timestamp } = msg.content;
        let buffer = Buffer.from(videoData, 'base64');
        //console.log(`Processing video data for user ${user_name} (ID: ${user_id}), buffer size: ${buffer.length} bytes`);
        saveRawVideoAdvance(buffer, user_name, timestamp, meetingUuid); // Primary method
      }
      //  Handle sharescreen data
      if (msg.msg_type === 16 && msg.content && msg.content.data) {
        let epochMilliseconds = Date.now();
        let { user_id, user_name, data: imgData, timestamp } = msg.content;
        let buffer = Buffer.from(imgData, 'base64');
        console.log(msg.content);
      }
         if (msg.msg_type === 16) {
        console.log('Sharescreen data received:', msg.content);
      }
      // Handle transcript data
      if (msg.msg_type === 17 && msg.content && msg.content.data) {
        let { user_id, user_name, data, timestamp } = msg.content;
        console.log(`Processing transcript: "${data}" from user ${user_name} (ID: ${user_id})`);
        writeTranscriptToVtt(user_name, timestamp / 1000, data, safeMeetingUuid);
      }

      // Handle chat data
      if (msg.msg_type === 18 && msg.content && msg.content.data) {
        let { user_id, user_name, data, timestamp } = msg.content;
        console.log(`Chat message from ${user_name} (ID: ${user_id}): "${data}"`);
      }
    } catch (err) {
      console.error('Error processing media message:', err);
    }
  });

  mediaWs.on('error', (err) => {
    console.error('Media socket error:', err);
  });

  mediaWs.on('close', () => {
    console.log('Media socket closed');
    if (activeConnections.has(meetingUuid)) {
      delete activeConnections.get(meetingUuid).media;
    }
  });
}

// GET /search - Serve the search page
app.get('/search', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'search.html'));
});



// POST /search - Handle query
app.post('/search', async (req, res) => {
  console.log('Search endpoint called with request body:', JSON.stringify(req.body, null, 2));
  const { query } = req.body;
  console.log('Extracted query:', query);
  if (!query) {
    console.log('Query is missing, sending 400 response');
    return res.status(400).send('Query is required');
  }

  try {
    console.log('Reading query prompt from file');
    // Read query prompt
    const queryPrompt = fs.readFileSync('query_prompt.md', 'utf-8');
    console.log('Query prompt loaded, length:', queryPrompt.length);

    // Read all .md files from meeting_summary
    let meetingSummaries = '';
    if (fs.existsSync('meeting_summary')) {
      console.log('Meeting summary directory exists, reading files');
      const files = fs.readdirSync('meeting_summary').filter(file => file.endsWith('.md'));
      console.log(`Found ${files.length} summary files`);
      for (const file of files) {
        console.log('Reading summary file:', file);
        const content = fs.readFileSync(`meeting_summary/${file}`, 'utf-8');
        meetingSummaries += `\n--- ${file} ---\n${content}\n`;
      }
      console.log('Total meeting summaries length:', meetingSummaries.length);
    } else {
      console.log('Meeting summary directory does not exist');
    }

    console.log('Replacing placeholders in prompt');
    // Replace placeholders
    const filledPrompt = queryPrompt
      .replace(/\{\{meeting_summaries\}\}/g, meetingSummaries)
      .replace(/\{\{query\}\}/g, query);
    console.log('Filled prompt length:', filledPrompt.length);

    console.log('Calling OpenRouter with query');
    // Call OpenRouter
    const answer = await chatWithOpenRouterFast(filledPrompt);
    console.log('Received answer from OpenRouter, length:', answer.length);

    console.log('Sending response to client');
    // Return the answer
     res.send(answer);
    //res.send('<pre>' + answer.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>') + '</pre>');
  } catch (error) {
    console.error('Error in search:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).send('Internal server error: ' + error.message);
  }
});

// GET /meeting-summary-files - Return list of .md files in meeting_summary
app.get('/meeting-summary-files', (req, res) => {
  try {
    const summaryDir = 'meeting_summary';
    if (fs.existsSync(summaryDir)) {
      const files = fs.readdirSync(summaryDir).filter(file => file.endsWith('.md'));
      res.json(files);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Error listing summary files:', error.message);
    res.status(500).send('Internal server error');
  }
});

// GET /meeting-summary/:fileName - Serve the content of a specific summary file
app.get('/meeting-summary/:fileName', (req, res) => {
  const { fileName } = req.params;
  const safeFileName = path.basename(fileName);
  try {
    const filePath = path.join('meeting_summary', safeFileName);
    if (fs.existsSync(filePath) && path.extname(filePath) === '.md') {
      const content = fs.readFileSync(filePath, 'utf-8');
      res.send(content);
    } else {
      res.status(404).send('Summary not found');
    }
  } catch (error) {
    console.error('Error reading summary file:', error.message);
    res.status(500).send('Internal server error');
  }
});

// Start the server and listen on the specified port
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Webhook endpoint available at http://localhost:${port}${WEBHOOK_PATH}`);
});
