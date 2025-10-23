import { useState, useEffect } from "react";

function SearchApp() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState('');
  const [meetingUuids, setMeetingUuids] = useState([]);
  const [selectedUuid, setSelectedUuid] = useState('');
  const [transcript, setTranscript] = useState('');
  const [meetingSummaries, setMeetingSummaries] = useState([]);
  const [selectedSummary, setSelectedSummary] = useState('');
  const [summaryContent, setSummaryContent] = useState('');

  const searchQuery = async (e) => {
    e.preventDefault();
    if (!query) return;

    setResults("Searching...");
    try {
      const response = await fetch('/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query })
      });
      if (response.ok) {
        const resultText = await response.text();
        setResults(resultText);

        const meetingUuidRegex = /<meeting_uuid>([^<]+)<\/meeting_uuid>/gi;
        const foundUuids = [];
        let match;
        while ((match = meetingUuidRegex.exec(resultText)) !== null) {
          foundUuids.push(match[1].trim());
        }

        setMeetingUuids(foundUuids);
        if (foundUuids.length > 0) {
          setSelectedUuid(foundUuids[0]);
        }
      } else {
        setResults('Error: ' + response.statusText);
      }
    } catch (error) {
      setResults('Error: ' + error.message);
    }
  };

  useEffect(() => {
    if (selectedUuid) loadMeetingContent(selectedUuid);
  }, [selectedUuid]);

  useEffect(() => {
    loadSummaryFiles();
  }, []);

  const loadMeetingContent = async (uuid) => {
    if (!uuid) {
      setTranscript('Please select a Meeting UUID.');
      return;
    }
    try {
      const textResponse = await fetch(`/recordings/${uuid}/transcript.vtt`);
      if (textResponse.ok) {
        const text = await textResponse.text();
        setTranscript(text);
      } else {
        setTranscript('Transcript not found.');
      }
    } catch (error) {
      setTranscript('Error loading content: ' + error.message);
    }
  };

  const loadSummaryFiles = async () => {
    try {
      const response = await fetch('/meeting-summary-files');
      if (response.ok) {
        const files = await response.json();
        setMeetingSummaries(files);
      } else {
        console.error('Failed to load summary files');
      }
    } catch (error) {
      console.error('Error loading summary files:', error);
    }
  };

  const loadSummaryContent = async (fileName) => {
    if (!fileName) {
      setSummaryContent('');
      return;
    }
    try {
      const response = await fetch(`/meeting-summary/${fileName}`);
      if (response.ok) {
        const content = await response.text();
        setSummaryContent(content);
      } else {
        setSummaryContent('Error loading summary.');
      }
    } catch (error) {
      setSummaryContent('Error loading summary.');
    }
  };

  useEffect(() => {
    if (selectedSummary) loadSummaryContent(selectedSummary);
  }, [selectedSummary]);

  return (
    <div>
      <form onSubmit={searchQuery}>
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask questions about your meeting summaries..." required />
        <button type="submit">Search</button>
      </form>
      <div style={{ whiteSpace: "pre-wrap", wordWrap: "break-word" }}>{results}</div>
      
      <div>
        <select value={selectedUuid} onChange={(e) => setSelectedUuid(e.target.value)}>
          <option value="">Select a Meeting UUID...</option>
          {meetingUuids.map((uuid) => (
            <option key={uuid} value={uuid}>{uuid}</option>
          ))}
        </select>
        <div>{transcript}</div>
      </div>
      
      <div>
        <select value={selectedSummary} onChange={(e) => setSelectedSummary(e.target.value)}>
          <option value="">Select a meeting summary...</option>
          {meetingSummaries.map((summary) => (
            <option key={summary} value={summary}>{summary}</option>
          ))}
        </select>
        <div>{summaryContent}</div>
      </div>
    </div>
  );
}

export default SearchApp;