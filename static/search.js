document.addEventListener('DOMContentLoaded', () => {
  // Search functionality
  const form = document.querySelector('.section form');
  const queryInput = document.getElementById('query-input');
  const results = document.getElementById('results');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = queryInput.value.trim();
    if (!query) {
      results.textContent = 'Please enter a query.';
      return;
    }
    results.textContent = 'Searching...';

    try {
      const response = await fetch('/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `query=${encodeURIComponent(query)}`
      });

      if (response.ok) {
        const result = await response.text();
        results.innerHTML = `<div style="white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word;">${result}</div>`;

        // Extract meeting UUIDs from the result using regex
        const meetingUuidRegex = /<meeting_uuid>([^<]+)<\/meeting_uuid>/gi;
        const foundUuids = [];
        let match;
        while ((match = meetingUuidRegex.exec(result)) !== null) {
          foundUuids.push(match[1].trim());
        }

        // Populate dropdown if UUIDs found
        if (foundUuids.length > 0) {
          // Clear existing options except the first
          while (meetingUuidSelect.children.length > 1) {
            meetingUuidSelect.removeChild(meetingUuidSelect.lastChild);
          }
          foundUuids.forEach(uuid => {
            const option = document.createElement('option');
            option.value = uuid;
            option.textContent = uuid;
            meetingUuidSelect.appendChild(option);
          });
          // Auto-load first meeting
          meetingUuidSelect.value = foundUuids[0];
          loadMeetingContent(foundUuids[0]);
        } else {
          console.log('No meeting UUIDs found in response');
        }
      } else {
        results.textContent = 'Error: ' + response.statusText;
      }
    } catch (error) {
      results.textContent = 'Error: ' + error.message;
    }
  });

  // Video loading
  const meetingUuidSelect = document.getElementById('meeting-uuid-select');
  const videoPlayer = document.getElementById('video-player');
  const transcriptDiv = document.getElementById('transcript-text');
  const vttTrack = document.getElementById('vtt-track');

  // Function to parse VTT time string to seconds
  const parseVTTTime = (timeStr) => {
    const [hms, ms] = timeStr.split('.');
    const [h, m, s] = hms.split(':').map(Number);
    return h * 3600 + m * 60 + s + Number(ms) / 1000;
  };

  // Function to populate transcript with clickable lines
  const populateTranscript = (text) => {
    transcriptDiv.innerHTML = ''; // Clear
    const lines = text.split('\n');
    let currentCue = null;
    let cueText = '';
    lines.forEach(line => {
      if (line.trim() === 'WEBVTT') {
        // Skip header
      } else if (line.includes('-->')) { // time line
        if (currentCue && cueText) {
          createCueElement(currentCue, cueText);
          cueText = '';
        }
        const [start, end] = line.split(' --> ');
        currentCue = { start: parseVTTTime(start), end: parseVTTTime(end) };
      } else if (line.trim() === '' && currentCue) {
        if (cueText) {
          createCueElement(currentCue, cueText);
          cueText = '';
          currentCue = null;
        }
      } else if (currentCue && line.trim() && !line.includes('-->') && !(!isNaN(line.trim()) && !line.includes(':'))) {
        // Accumulate text lines
        cueText += line.trim() + ' ';
      } else if (currentCue && !isNaN(line.trim()) && line.trim() !== '') {
        // Cue id, skip
      }
    });
    if (currentCue && cueText) {
      createCueElement(currentCue, cueText);
    }
  };

  // Function to create a clickable transcript element
  const createCueElement = (cue, text) => {
    const div = document.createElement('div');
    div.textContent = text.trim();
    div.classList.add('transcript-line');
    div.onclick = () => {
      videoPlayer.currentTime = cue.start;
    };
    transcriptDiv.appendChild(div);
  };

  // Function to load video and transcript for a given UUID
  const loadMeetingContent = async (uuid) => {
    if (!uuid) {
      transcriptDiv.textContent = 'Please select a Meeting UUID.';
      return;
    }

    // Sanitize UUID for path
    const safeUuid = uuid.replace(/[<>:"\/\\|?*=\s]/g, '_');

    try {
      // Load transcript text
      const textResponse = await fetch(`/recordings/${safeUuid}/transcript.vtt`);
      if (textResponse.ok) {
        const transcriptText = await textResponse.text();
        populateTranscript(transcriptText);
      } else {
        transcriptDiv.textContent = 'Transcript not found.';
      }

      // Load the final output video
      const videoSrc = `/recordings/${safeUuid}/final_output.mp4`;
      const vttSrc = `/recordings/${safeUuid}/transcript.vtt`;

      videoPlayer.src = videoSrc;
      vttTrack.src = vttSrc;

    } catch (error) {
      transcriptDiv.textContent = 'Error loading content: ' + error.message;
    }
  };



  // Handle dropdown change
  meetingUuidSelect.addEventListener('change', async () => {
    const selectedUuid = meetingUuidSelect.value;
    loadMeetingContent(selectedUuid);
  });

  // Summary functionality
  const summarySelect = document.getElementById('summary-select');
  const summaryResults = document.getElementById('summary-results');

  // Function to load summary files
  const loadSummaryFiles = async () => {
    try {
      const response = await fetch('/meeting-summary-files');
      if (response.ok) {
        const files = await response.json();
        summarySelect.innerHTML = '<option value="">Select a meeting summary...</option>';
        files.forEach(file => {
          const option = document.createElement('option');
          option.value = file;
          option.textContent = file;
          summarySelect.appendChild(option);
        });
      } else {
        console.error('Failed to load summary files');
      }
    } catch (error) {
      console.error('Error loading summary files:', error);
    }
  };

  // Simple markdown to HTML converter
  const markdownToHtml = (markdown) => {
    // Just remove the tags and keep the content simple
    let processed = markdown
      // Remove section start markers like DECISIONS>
      .replace(/^([A-Z_]+)>$/gm, '')
      // Remove section end markers like </words>
      .replace(/([A-Z_]+)>$/gm, '')
      // Remove UUID markers but keep the UUID
      .replace(/^UUID>([^>]+)UUID>$/gm, '<div class="uuid-section"><strong>UUID:</strong> $1</div>');

    // Simple formatting - just preserve line breaks and basic structure
    processed = processed
      // Convert line breaks to br tags
      .replace(/\n/g, '<br>')
      // Handle word count
      .replace(/Word Count: (\d+)$/, '<div class="word-count">Word Count: $1</div>');

    return '<div class="summary-content">' + processed + '</div>';
  };

  // Function to load summary content
  const loadSummaryContent = async (fileName) => {
    if (!fileName) {
      summaryResults.innerHTML = '';
      return;
    }
    try {
      const response = await fetch(`/meeting-summary/${fileName}`);
      if (response.ok) {
        const content = await response.text();
        summaryResults.innerHTML = markdownToHtml(content);
      } else {
        summaryResults.innerHTML = 'Error loading summary.';
      }
    } catch (error) {
      summaryResults.innerHTML = 'Error loading summary.';
    }
  };

  // Handle summary dropdown change
  summarySelect.addEventListener('change', async () => {
    const selectedFile = summarySelect.value;
    loadSummaryContent(selectedFile);
  });

  // Load summary files on page load
  loadSummaryFiles();
});
