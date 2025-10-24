import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

function SentimentChart({ data }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!data || Object.keys(data).length === 0) return
    if (!svgRef.current || !containerRef.current) return

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove()

    const margin = { top: 20, right: 80, bottom: 50, left: 120 }
    const width = containerRef.current.clientWidth - margin.left - margin.right
    const height = 200 - margin.top - margin.bottom

    const svg = d3
      .select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Prepare data for stacked bar chart
    const users = Object.keys(data)
    const colors = ['#dc3545', '#ffc107', '#28a745'] // negative, neutral, positive

    const stackedData = users.map((user) => {
      const userData = data[user]
      return {
        user,
        negative: userData.negative || 0,
        neutral: userData.neutral || 0,
        positive: userData.positive || 0,
        total: (userData.negative || 0) + (userData.neutral || 0) + (userData.positive || 0),
      }
    })

    const maxTotal = d3.max(stackedData, (d) => d.total) || 10
    const yDomainMax = Math.max(maxTotal * 1.1, 10)

    // Scales
    const xScale = d3
      .scaleBand()
      .domain(stackedData.map((d) => d.user))
      .range([0, width])
      .padding(0.2)

    const yScale = d3.scaleLinear().domain([0, yDomainMax]).range([height, 0])

    // Create stacked bars
    const stack = d3.stack().keys(['negative', 'neutral', 'positive'])
    const series = stack(stackedData)

    // Create layers for each sentiment type
    series.forEach((layer, i) => {
      svg
        .selectAll(`.bar-${i}`)
        .data(layer)
        .enter()
        .append('rect')
        .attr('class', `bar-${i}`)
        .attr('x', (d) => xScale(d.data.user))
        .attr('y', (d) => yScale(d[1]))
        .attr('height', (d) => Math.max(0, yScale(d[0]) - yScale(d[1])))
        .attr('width', xScale.bandwidth())
        .attr('fill', colors[i])
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
    })

    // Add axes
    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .style('font-size', '10px')

    svg.append('g').call(d3.axisLeft(yScale)).selectAll('text').style('font-size', '10px')

    // Add legend
    const legend = svg.append('g').attr('transform', `translate(${width - 80}, 10)`)

    const legendData = [
      { label: 'Negative', color: colors[0] },
      { label: 'Neutral', color: colors[1] },
      { label: 'Positive', color: colors[2] },
    ]

    legendData.forEach((d, i) => {
      const legendRow = legend.append('g').attr('transform', `translate(0, ${i * 15})`)

      legendRow.append('rect').attr('width', 10).attr('height', 10).attr('fill', d.color)

      legendRow
        .append('text')
        .attr('x', 15)
        .attr('y', 9)
        .style('font-size', '10px')
        .style('text-anchor', 'start')
        .text(d.label)
    })
  }, [data])

  return (
    <div ref={containerRef} className="sentiment-chart-container">
      <svg ref={svgRef}></svg>
    </div>
  )
}

export default SentimentChart
