import { useEffect, useRef, useState, useCallback } from 'react'

export function useWebSocket(meetingUuid = 'global') {
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState([])
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)

  const connect = useCallback(async () => {
    try {
      // Load WebSocket configuration
      const configResponse = await fetch('/api/config')
      if (!configResponse.ok) {
        throw new Error('Failed to load WebSocket configuration')
      }

      const config = await configResponse.json()
      let websocketUrl = config.websocketUrl

      // Ensure WebSocket URL has proper protocol
      if (!websocketUrl.startsWith('ws://') && !websocketUrl.startsWith('wss://')) {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        websocketUrl = (isLocalhost ? 'ws://' : 'wss://') + websocketUrl
      }

      const url = `${websocketUrl}?meeting=${encodeURIComponent(meetingUuid)}`
      console.log('Connecting to WebSocket:', url)

      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setMessages((prev) => [...prev, data])
        } catch (err) {
          console.error('Error parsing WebSocket message:', err)
        }
      }

      ws.onclose = (event) => {
        console.log('WebSocket disconnected, code:', event.code)
        setIsConnected(false)

        // Auto-reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...')
          connect()
        }, 5000)
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setIsConnected(false)
      }
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error)
      setIsConnected(false)
    }
  }, [meetingUuid])

  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    isConnected,
    messages,
    sendMessage,
    disconnect,
    reconnect: connect,
  }
}
