import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import '../styles/MeetingDetailPage.css'

function MeetingDetailPage() {
  const { meetingId } = useParams()
  const [meeting, setMeeting] = useState(null)
  const [transcript, setTranscript] = useState([])
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(true)
  const videoRef = useRef(null)

  useEffect(() => {
    loadMeetingData()
  }, [meetingId])

  const loadMeetingData = async () => {
    try {
      // Sanitize UUID for filesystem
      const safeUuid = meetingId.replace(/[<>:"\/\\|?*=\s]/g, '_')

      // Load meeting metadata
      const metadataResponse = await fetch(`/api/meetings/${meetingId}`)
      if (metadataResponse.ok) {
        const data = await metadataResponse.json()
        setMeeting(data)
      }

      // Load transcript
      const transcriptResponse = await fetch(`/recordings/${safeUuid}/transcript.vtt`)
      if (transcriptResponse.ok) {
        const vttText = await transcriptResponse.text()
        const parsedTranscript = parseVTT(vttText)
        setTranscript(parsedTranscript)
      }

      // Load summary
      const summaryResponse = await fetch(`/meeting-summary/${safeUuid}.md`)
      if (summaryResponse.ok) {
        const summaryText = await summaryResponse.text()
        setSummary(summaryText)
      }
    } catch (error) {
      console.error('Error loading meeting data:', error)
    } finally {
      setLoading(false)
    }
  }

  const parseVTT = (vttText) => {
    const lines = vttText.split('\n')
    const cues = []
    let currentCue = null
    let cueText = ''

    for (const line of lines) {
      if (line.trim() === 'WEBVTT') continue

      if (line.includes('-->')) {
        if (currentCue && cueText) {
          cues.push({ ...currentCue, text: cueText.trim() })
          cueText = ''
        }
        const [start, end] = line.split(' --> ')
        currentCue = { start: parseVTTTime(start), end: parseVTTTime(end) }
      } else if (line.trim() === '' && currentCue) {
        if (cueText) {
          cues.push({ ...currentCue, text: cueText.trim() })
          cueText = ''
          currentCue = null
        }
      } else if (currentCue && line.trim() && !(!isNaN(line.trim()))) {
        cueText += line.trim() + ' '
      }
    }

    if (currentCue && cueText) {
      cues.push({ ...currentCue, text: cueText.trim() })
    }

    return cues
  }

  const parseVTTTime = (timeStr) => {
    const [hms, ms] = timeStr.split('.')
    const [h, m, s] = hms.split(':').map(Number)
    return h * 3600 + m * 60 + s + Number(ms || 0) / 1000
  }

  const jumpToTime = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time
    }
  }

  if (loading) {
    return (
      <div className="meeting-detail-page">
        <div className="container">
          <div className="loading">Loading meeting...</div>
        </div>
      </div>
    )
  }

  const safeUuid = meetingId.replace(/[<>:"\/\\|?*=\s]/g, '_')

  return (
    <div className="meeting-detail-page">
      <div className="container">
        <header className="page-header">
          <h1>Meeting Assistant</h1>
          <nav className="main-nav">
            <Link to="/home" className="nav-link">Home</Link>
            <Link to="/meetings" className="nav-link">Meetings</Link>
          </nav>
        </header>

        <div className="back-link">
          <Link to="/meetings">← Back to Meetings</Link>
        </div>

        <section className="meeting-header">
          <h2>{meeting?.title || meetingId}</h2>
          {meeting?.date && (
            <p className="meeting-date">
              {new Date(meeting.date).toLocaleDateString()} at {new Date(meeting.date).toLocaleTimeString()}
            </p>
          )}
        </section>

        {summary && (
          <section className="summary-section">
            <h3>Summary</h3>
            <div className="summary-content">
              <pre>{summary}</pre>
            </div>
          </section>
        )}

        <section className="playback-section">
          <h3>Recording & Transcript</h3>
          <div className="video-transcript-container">
            <div className="video-container">
              <video
                ref={videoRef}
                controls
                className="video-player"
              >
                <source src={`/recordings/${safeUuid}/final_output.mp4`} type="video/mp4" />
                <track
                  kind="subtitles"
                  src={`/recordings/${safeUuid}/transcript.vtt`}
                  srcLang="en"
                  label="English"
                />
              </video>
            </div>

            <div className="transcript-container">
              <h4>Transcript</h4>
              <div className="transcript-scrollable">
                {transcript.length === 0 && (
                  <p className="empty-state">No transcript available.</p>
                )}
                {transcript.map((cue, idx) => (
                  <div
                    key={idx}
                    className="transcript-line"
                    onClick={() => jumpToTime(cue.start)}
                  >
                    <span className="timestamp">
                      {new Date(cue.start * 1000).toISOString().substr(11, 8)}
                    </span>
                    <span className="text">{cue.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default MeetingDetailPage
