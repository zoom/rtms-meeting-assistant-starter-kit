import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import MeetingsListPage from './pages/MeetingsListPage'
import MeetingDetailPage from './pages/MeetingDetailPage'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/meetings" element={<MeetingsListPage />} />
        <Route path="/meetings/:meetingId" element={<MeetingDetailPage />} />
      </Routes>
    </Router>
  )
}

export default App
