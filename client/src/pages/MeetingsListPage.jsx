import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import '../styles/MeetingsListPage.css'

function MeetingsListPage() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadMeetings()
  }, [])

  const loadMeetings = async () => {
    try {
      const response = await fetch('/api/meetings')
      if (response.ok) {
        const data = await response.json()
        setMeetings(data)
      }
    } catch (error) {
      console.error('Error loading meetings:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredMeetings = meetings.filter((meeting) =>
    (meeting.title || meeting.uuid).toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="meetings-list-page">
      <div className="container">
        <header className="page-header">
          <h1>Meeting Assistant</h1>
          <nav className="main-nav">
            <Link to="/home" className="nav-link">Home</Link>
            <Link to="/meetings" className="nav-link active">Meetings</Link>
          </nav>
        </header>

        <section className="meetings-section">
          <div className="section-header">
            <h2>All Meetings</h2>
            <input
              type="text"
              placeholder="Search meetings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          {loading && <div className="loading">Loading meetings...</div>}

          {!loading && filteredMeetings.length === 0 && (
            <div className="empty-state">
              {searchTerm ? 'No meetings found matching your search.' : 'No meetings recorded yet.'}
            </div>
          )}

          {!loading && filteredMeetings.length > 0 && (
            <div className="meetings-table">
              <div className="table-header">
                <div className="col-title">Title</div>
                <div className="col-date">Date</div>
                <div className="col-duration">Duration</div>
                <div className="col-actions">Actions</div>
              </div>
              {filteredMeetings.map((meeting) => (
                <div key={meeting.uuid} className="table-row">
                  <div className="col-title">
                    {meeting.title || meeting.uuid}
                  </div>
                  <div className="col-date">
                    {new Date(meeting.date).toLocaleDateString()} {new Date(meeting.date).toLocaleTimeString()}
                  </div>
                  <div className="col-duration">
                    {meeting.duration || 'N/A'}
                  </div>
                  <div className="col-actions">
                    <Link to={`/meetings/${meeting.uuid}`} className="view-button">
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default MeetingsListPage
