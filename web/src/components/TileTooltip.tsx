import React from 'react'
import './TileTooltip.css'

interface TileTooltipProps {
  x: number
  y: number
  visible: boolean
  tileData: {
    biome: string
    elevation: number
    worldX: number
    worldY: number
    chunkX: number
    chunkY: number
    localX: number
    localY: number
  } | null
}

/**
 * Tooltip component for displaying tile information on hover/tap
 */
const TileTooltip: React.FC<TileTooltipProps> = ({ x, y, visible, tileData }) => {
  if (!visible || !tileData) {
    return null
  }

  const formatBiome = (biome: string): string => {
    return biome.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const formatElevation = (elevation: number): string => {
    return Math.round(elevation * 100).toString()
  }

  return (
    <div 
      className="tile-tooltip"
      style={{
        left: x,
        top: y,
      }}
    >
      <div className="tooltip-header">
        <strong>{formatBiome(tileData.biome)}</strong>
      </div>
      <div className="tooltip-content">
        <div className="tooltip-row">
          <span className="tooltip-label">Position:</span>
          <span className="tooltip-value">({tileData.worldX}, {tileData.worldY})</span>
        </div>
        <div className="tooltip-row">
          <span className="tooltip-label">Chunk:</span>
          <span className="tooltip-value">({tileData.chunkX}, {tileData.chunkY})</span>
        </div>
        <div className="tooltip-row">
          <span className="tooltip-label">Local:</span>
          <span className="tooltip-value">({tileData.localX}, {tileData.localY})</span>
        </div>
        <div className="tooltip-row">
          <span className="tooltip-label">Elevation:</span>
          <span className="tooltip-value">{formatElevation(tileData.elevation)}%</span>
        </div>
      </div>
    </div>
  )
}

export default TileTooltip