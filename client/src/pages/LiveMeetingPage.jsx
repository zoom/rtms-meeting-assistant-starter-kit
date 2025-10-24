import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useWebSocket } from '../hooks/useWebSocket'
import '../styles/LiveMeetingPage.css'

function LiveMeetingPage() {
  const { meetingId } = useParams()
  const { isConnected, messages } = useWebSocket(meetingId || 'global')

  const [transcript, setTranscript] = useState([])
  const [sentimentWords, setSentimentWords] = useState([])
  const [dialogSuggestions, setDialogSuggestions] = useState([])
  const [meetingSummary, setMeetingSummary] = useState('')
  const [query, setQuery] = useState('')
  const [queryResult, setQueryResult] = useState('')
  const [isQuerying, setIsQuerying] = useState(false)
  const [isAnalyzingSentiment, setIsAnalyzingSentiment] = useState(false)

  // Process WebSocket messages
  useEffect(() => {
    if (messages.length === 0) return

    const lastMessage = messages[messages.length - 1]

    switch (lastMessage.type) {
      case 'transcript':
        const timestamp = new Date(lastMessage.timestamp > 1e12 ? lastMessage.timestamp : lastMessage.timestamp * 1000).toLocaleTimeString()
        const user = lastMessage.user ? `${lastMessage.user}: ` : ''
        setTranscript((prev) => [...prev, { timestamp, user, text: lastMessage.text }])
        break

      case 'ai_dialog':
        setDialogSuggestions(lastMessage.suggestions || [])
        break

      case 'meeting_summary':
        setMeetingSummary(lastMessage.summary || '')
        break

      default:
        console.log('Unknown message type:', lastMessage.type)
    }
  }, [messages])

  const handleAnalyzeSentiment = async () => {
    setIsAnalyzingSentiment(true)
    setSentimentWords([])

    try {
      const response = await fetch('/api/analyze-sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingUuid: meetingId || 'global',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setSentimentWords(data.sentimentWords || [])
      } else {
        setSentimentWords(['Error analyzing sentiment'])
      }
    } catch (error) {
      console.error('Sentiment analysis error:', error)
      setSentimentWords(['Error connecting to service'])
    } finally {
      setIsAnalyzingSentiment(false)
    }
  }

  const handleQuery = async (e) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsQuerying(true)
    setQueryResult('Asking AI...')

    try {
      const response = await fetch('/api/meeting-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          meetingUuid: meetingId || 'global',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setQueryResult(data.answer)
      } else {
        setQueryResult('Failed to get response from AI.')
      }
    } catch (error) {
      console.error('Query error:', error)
      setQueryResult('Error connecting to AI service.')
    } finally {
      setIsQuerying(false)
    }
  }

  return (
    <div className="live-meeting-page">
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

        <section className="connection-status">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected - Live' : '🔴 Disconnected'}
          </div>
          <h2>Live Meeting: {meetingId || 'All Meetings'}</h2>
        </section>

        <div className="live-dashboard">
          {/* Real-time Transcript */}
          <section className="dashboard-section transcript-section">
            <h3>Live Transcript</h3>
            <div className="transcript-box">
              {transcript.length === 0 && <p className="empty-state">Waiting for transcript...</p>}
              {transcript.map((line, idx) => (
                <div key={idx} className="transcript-line">
                  <span className="timestamp">[{line.timestamp}]</span>
                  <span className="user">{line.user}</span>
                  <span className="text">{line.text}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Sentiment Analysis */}
          <section className="dashboard-section sentiment-section">
            <h3>Meeting Sentiment</h3>
            <button
              onClick={handleAnalyzeSentiment}
              className="sentiment-button"
              disabled={isAnalyzingSentiment}
            >
              {isAnalyzingSentiment ? 'Analyzing...' : 'Analyze Sentiment'}
            </button>
            {sentimentWords.length > 0 && (
              <div className="sentiment-words">
                {sentimentWords.map((word, idx) => (
                  <span key={idx} className="sentiment-word">
                    {word}
                  </span>
                ))}
              </div>
            )}
            {sentimentWords.length === 0 && !isAnalyzingSentiment && (
              <p className="sentiment-info">Click the button to analyze overall meeting sentiment</p>
            )}
          </section>

          {/* Dialog Suggestions */}
          <section className="dashboard-section suggestions-section">
            <h3>AI Dialog Suggestions</h3>
            <div className="suggestions-box">
              {dialogSuggestions.length === 0 && (
                <p className="empty-state">No suggestions yet...</p>
              )}
              {dialogSuggestions.map((suggestion, idx) => (
                <div key={idx} className="suggestion-item">
                  <strong>{idx + 1}.</strong> {suggestion}
                </div>
              ))}
            </div>
          </section>

          {/* Real-time Summary */}
          <section className="dashboard-section summary-section">
            <h3>Meeting Summary (Live)</h3>
            <div className="summary-box">
              {meetingSummary ? (
                <div dangerouslySetInnerHTML={{ __html: meetingSummary }} />
              ) : (
                <p className="empty-state">Summary not available yet...</p>
              )}
            </div>
          </section>

          {/* Query Interface */}
          <section className="dashboard-section query-section">
            <h3>Ask About This Meeting</h3>
            <form onSubmit={handleQuery} className="query-form">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a question about the current meeting..."
                className="query-input"
                disabled={isQuerying}
              />
              <button type="submit" className="query-button" disabled={isQuerying}>
                {isQuerying ? 'Asking...' : 'Ask'}
              </button>
            </form>
            {queryResult && (
              <div className="query-result">
                <div dangerouslySetInnerHTML={{ __html: queryResult }} />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default LiveMeetingPage
