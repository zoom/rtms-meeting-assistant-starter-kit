import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useMeetingTopics } from '../context/MeetingTopicsContext'
import { encodeMeetingId } from '../utils/meetingUtils'
import '../styles/HomePage.css'

function HomePage() {
  const { getDisplayName } = useMeetingTopics()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [recentMeetings, setRecentMeetings] = useState([])
  const [liveMeetings, setLiveMeetings] = useState([])

  useEffect(() => {
    // Load recent meetings and live meetings
    loadRecentMeetings()
    loadLiveMeetings()

    // Poll for live meetings every 10 seconds
    const interval = setInterval(loadLiveMeetings, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadRecentMeetings = async () => {
    try {
      const response = await fetch('/api/meetings?limit=5')
      if (response.ok) {
        const data = await response.json()
        setRecentMeetings(data)
      }
    } catch (error) {
      console.error('Error loading recent meetings:', error)
    }
  }

  const loadLiveMeetings = async () => {
    try {
      const response = await fetch('/api/live-meetings')
      if (response.ok) {
        const data = await response.json()
        setLiveMeetings(data)
      }
    } catch (error) {
      console.error('Error loading live meetings:', error)
    }
  }

  const searchQuery = async (e) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsSearching(true)
    setResults('Searching...')

    try {
      const response = await fetch('/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query })
      })

      if (response.ok) {
        const resultText = await response.text()
        setResults(resultText)
      } else {
        setResults('Error: ' + response.statusText)
      }
    } catch (error) {
      setResults('Error: ' + error.message)
    } finally {
      setIsSearching(false)
    }
  }

  const suggestedPrompts = [
    "What did I commit to this week?",
    "Decisions made last meeting?",
    "Action items from yesterday?",
  ]

  return (
    <div className="home-page">
      <div className="container">
        <header className="page-header">
          <h1>Meeting Assistant</h1>
          <nav className="main-nav">
            <Link to="/home" className="nav-link active">Home</Link>
            <Link to="/meetings" className="nav-link">Meetings</Link>
          </nav>
        </header>

        <section className="chat-section">
          <h2>Chat with your Notetaker</h2>
          <form onSubmit={searchQuery} className="search-form">
            <div className="search-box">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask questions about your meeting summaries..."
                className="search-input"
                required
              />
              <button type="submit" className="search-button" disabled={isSearching}>
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>

          {results && (
            <div className="results-box">
              <div dangerouslySetInnerHTML={{ __html: results }} />
            </div>
          )}

          {!results && (
            <div className="suggested-prompts">
              <p className="prompts-label">Suggested prompts:</p>
              {suggestedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  className="prompt-button"
                  onClick={() => setQuery(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </section>

        {liveMeetings.length > 0 && (
          <section className="live-meetings">
            <h3>
              <span className="live-indicator">🔴</span> Live Meetings
            </h3>
            <div className="meetings-list">
              {liveMeetings.map((meeting) => (
                <Link
                  key={meeting.uuid}
                  to={`/meeting/${encodeMeetingId(meeting.uuid)}`}
                  className="meeting-card live-card"
                >
                  <div className="meeting-title">
                    <span className="live-badge">LIVE</span>
                    {getDisplayName(meeting.uuid)}
                  </div>
                  <div className="meeting-status">
                    Active meeting in progress
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {recentMeetings.length > 0 && (
          <section className="recent-meetings">
            <h3>Recent Meetings</h3>
            <div className="meetings-list">
              {recentMeetings.map((meeting) => (
                <Link
                  key={meeting.uuid}
                  to={`/meetings/${meeting.uuid}`}
                  className="meeting-card"
                >
                  <div className="meeting-title">{getDisplayName(meeting.uuid)}</div>
                  <div className="meeting-date">{new Date(meeting.date).toLocaleDateString()}</div>
                </Link>
              ))}
            </div>
            <Link to="/meetings" className="view-all-link">
              View All Meetings →
            </Link>
          </section>
        )}

        {recentMeetings.length === 0 && !results && (
          <div className="empty-state">
            <p>No meetings yet — start a Zoom meeting with the RTMS app enabled.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default HomePage
