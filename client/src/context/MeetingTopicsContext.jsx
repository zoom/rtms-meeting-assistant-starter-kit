import { createContext, useState, useEffect, useContext } from 'react'

const MeetingTopicsContext = createContext()

export function MeetingTopicsProvider({ children }) {
  const [topics, setTopics] = useState({}) // { "Topic Name": "sanitized_uuid" }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadTopics = async () => {
      try {
        const response = await fetch('/meeting-topics')
        if (response.ok) {
          const data = await response.json()
          setTopics(data)
          console.log('Loaded meeting topics:', data)
        } else {
          console.error('Failed to load meeting topics')
        }
      } catch (error) {
        console.error('Error loading meeting topics:', error)
      } finally {
        setLoading(false)
      }
    }

    loadTopics()
  }, [])

  // Find topic name for a given UUID
  const getTopicForUuid = (uuid) => {
    if (!uuid) return null
    // topics maps topic -> uuid, we need to find the key
    return Object.keys(topics).find((topic) => topics[topic] === uuid)
  }

  // Get display name with topic and short UUID
  const getDisplayName = (uuid) => {
    if (!uuid) return 'Unknown Meeting'

    const topic = getTopicForUuid(uuid)
    const shortUuid = uuid.replace(/[_]/g, '').substring(0, 8)

    return topic ? `${topic} (${shortUuid}...)` : `Meeting ${shortUuid}...`
  }

  // Get just the topic name
  const getTopicName = (uuid) => {
    return getTopicForUuid(uuid) || uuid
  }

  return (
    <MeetingTopicsContext.Provider
      value={{
        topics,
        loading,
        getTopicForUuid,
        getDisplayName,
        getTopicName,
      }}
    >
      {children}
    </MeetingTopicsContext.Provider>
  )
}

export const useMeetingTopics = () => {
  const context = useContext(MeetingTopicsContext)
  if (!context) {
    throw new Error('useMeetingTopics must be used within MeetingTopicsProvider')
  }
  return context
}
