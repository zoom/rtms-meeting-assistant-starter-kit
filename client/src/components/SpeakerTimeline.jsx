import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

function SpeakerTimeline({ transcript, videoRef }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const timeIndicatorRef = useRef(null)

  useEffect(() => {
    if (!transcript || transcript.length === 0) return
    if (!svgRef.current || !containerRef.current) return

    // Parse speaker names and create timeline data
    const parseSpeakerName = (text) => {
      const speakerMatch = text.match(/^([^:]+):\s*/)
      return speakerMatch ? speakerMatch[1].trim() : 'Unknown Speaker'
    }

    const timelineData = transcript.map((cue) => ({
      speaker: parseSpeakerName(cue.text),
      start: cue.start,
      end: cue.end,
      text: cue.text,
    }))

    const totalDuration = Math.max(...timelineData.map((d) => d.end))

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove()

    const margin = { top: 20, right: 80, bottom: 30, left: 120 }
    const width = containerRef.current.clientWidth - margin.left - margin.right
    const height = 100 - margin.top - margin.bottom

    const svg = d3
      .select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Create scales
    const xScale = d3.scaleLinear().domain([0, totalDuration]).range([0, width])

    const speakers = Array.from(new Set(timelineData.map((d) => d.speaker)))
    const yScale = d3.scaleBand().domain(speakers).range([0, height]).padding(0.1)

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10)

    // Add axes
    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3.axisBottom(xScale).tickFormat((d) => {
          const minutes = Math.floor(d / 60)
          const seconds = Math.floor(d % 60)
          return `${minutes}:${seconds.toString().padStart(2, '0')}`
        })
      )

    svg.append('g').call(d3.axisLeft(yScale))

    // Add speaker bars
    svg
      .selectAll('.speaker-bar')
      .data(timelineData)
      .enter()
      .append('rect')
      .attr('class', 'speaker-bar')
      .attr('x', (d) => xScale(d.start))
      .attr('y', (d) => yScale(d.speaker))
      .attr('width', (d) => Math.max(2, xScale(d.end) - xScale(d.start)))
      .attr('height', yScale.bandwidth())
      .attr('fill', (d) => colorScale(d.speaker))
      .attr('rx', 2)
      .style('cursor', 'pointer')
      .on('click', function (event, d) {
        if (videoRef && videoRef.current) {
          videoRef.current.currentTime = d.start
        }
      })

    // Add time indicator line
    const timeIndicator = svg
      .append('line')
      .attr('class', 'time-indicator')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', 'red')
      .attr('stroke-width', 2)

    timeIndicatorRef.current = { timeIndicator, xScale }

    // Update time indicator on video timeupdate
    const updateTimeIndicator = () => {
      if (videoRef && videoRef.current && timeIndicatorRef.current) {
        const currentTime = videoRef.current.currentTime
        const xPos = timeIndicatorRef.current.xScale(currentTime)
        timeIndicatorRef.current.timeIndicator.attr('x1', xPos).attr('x2', xPos)
      }
    }

    if (videoRef && videoRef.current) {
      videoRef.current.addEventListener('timeupdate', updateTimeIndicator)
    }

    return () => {
      if (videoRef && videoRef.current) {
        videoRef.current.removeEventListener('timeupdate', updateTimeIndicator)
      }
    }
  }, [transcript, videoRef])

  return (
    <div ref={containerRef} className="speaker-timeline-container">
      <svg ref={svgRef}></svg>
    </div>
  )
}

export default SpeakerTimeline
