import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMeetingTopics } from '../context/MeetingTopicsContext'
import { decodeMeetingId, sanitizeMeetingId } from '../utils/meetingUtils'
import SpeakerTimeline from '../components/SpeakerTimeline'
import '../styles/MeetingDetailPage.css'

function MeetingDetailPage() {
  const { meetingId: encodedMeetingId } = useParams()
  const meetingId = decodeMeetingId(encodedMeetingId)
  const { getDisplayName } = useMeetingTopics()
  const [meeting, setMeeting] = useState(null)
  const [transcript, setTranscript] = useState([])
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(true)
  const [showPDF, setShowPDF] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [hasPDF, setHasPDF] = useState(false)
  const videoRef = useRef(null)
  const transcriptRefs = useRef([])

  useEffect(() => {
    loadMeetingData()
  }, [meetingId])

  const loadMeetingData = async () => {
    try {
      const safeUuid = sanitizeMeetingId(meetingId)

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

      // Check if PDF exists
      const pdfResponse = await fetch(`/meeting-pdf/${meetingId}`, { method: 'HEAD' })
      setHasPDF(pdfResponse.ok)
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

  // Transcript highlighting - update as video plays
  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement || transcript.length === 0) return

    let previousIndex = -1

    const handleTimeUpdate = () => {
      const currentTime = videoElement.currentTime
      let currentIndex = -1

      // Find which transcript line matches current time
      for (let i = 0; i < transcript.length; i++) {
        const cue = transcript[i]
        if (currentTime >= cue.start && currentTime <= cue.end) {
          currentIndex = i
          break
        }
      }

      // Remove highlight from previous line
      if (previousIndex !== -1 && previousIndex !== currentIndex && transcriptRefs.current[previousIndex]) {
        transcriptRefs.current[previousIndex].classList.remove('active')
      }

      // Add highlight to current line
      if (currentIndex !== -1 && transcriptRefs.current[currentIndex]) {
        const element = transcriptRefs.current[currentIndex]
        element.classList.add('active')

        // Auto-scroll to keep current line visible
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }

      previousIndex = currentIndex
    }

    videoElement.addEventListener('timeupdate', handleTimeUpdate)

    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [transcript])

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
            <Link to="/home" className="nav-link">
              Home
            </Link>
            <Link to="/meetings" className="nav-link">
              Meetings
            </Link>
          </nav>
        </header>

        <div className="back-link">
          <Link to="/meetings">← Back to Meetings</Link>
        </div>

        <section className="meeting-header">
          <h2>{getDisplayName(meetingId)}</h2>
          {meeting?.date && (
            <p className="meeting-date">
              {new Date(meeting.date).toLocaleDateString()} at{' '}
              {new Date(meeting.date).toLocaleTimeString()}
            </p>
          )}
          <div className="action-buttons">
            {summary && (
              <button onClick={() => setShowSummary(!showSummary)} className="action-button">
                {showSummary ? 'Hide Summary' : 'View Summary'}
              </button>
            )}
            {hasPDF && (
              <button onClick={() => setShowPDF(!showPDF)} className="action-button">
                {showPDF ? 'Hide PDF' : 'View Screen Share PDF'}
              </button>
            )}
          </div>
        </section>

        {showSummary && summary && (
          <section className="summary-overlay">
            <div className="summary-content">
              <button onClick={() => setShowSummary(false)} className="close-button">
                ✕ Close
              </button>
              <pre>{summary}</pre>
            </div>
          </section>
        )}

        {showPDF && hasPDF && (
          <section className="pdf-overlay">
            <div className="pdf-content">
              <button onClick={() => setShowPDF(false)} className="close-button">
                ✕ Close
              </button>
              <iframe
                src={`/meeting-pdf/${encodeURIComponent(meetingId)}`}
                className="pdf-iframe"
                title="Meeting Screen Share PDF"
              />
            </div>
          </section>
        )}

        <section className="playback-section">
          <h3>Recording & Transcript</h3>

          {/* Speaker Timeline */}
          {transcript.length > 0 && (
            <div className="timeline-section">
              <h4>Speaker Timeline</h4>
              <SpeakerTimeline transcript={transcript} videoRef={videoRef} />
            </div>
          )}

          <div className="video-transcript-container">
            <div className="video-container">
              <video ref={videoRef} controls className="video-player">
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
                {transcript.length === 0 && <p className="empty-state">No transcript available.</p>}
                {transcript.map((cue, idx) => (
                  <div
                    key={idx}
                    ref={(el) => (transcriptRefs.current[idx] = el)}
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
