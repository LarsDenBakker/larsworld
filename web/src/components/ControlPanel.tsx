import React, { useState, useEffect } from 'react'
import './ControlPanel.css'

interface ControlPanelProps {
  minX: number
  maxX: number
  minY: number
  maxY: number
  worldName: string
  isGenerating: boolean
  isPaused: boolean
  statusMessage: string
  onCoordinateChange: (changes: { [key: string]: number }) => void
  onWorldNameChange: (worldName: string) => void
  onStartGeneration: () => void
  onPauseGeneration: () => void
}

/**
 * Control panel component for world generation parameters
 */
const ControlPanel: React.FC<ControlPanelProps> = ({
  minX,
  maxX,
  minY,
  maxY,
  worldName,
  isGenerating,
  isPaused,
  statusMessage,
  onCoordinateChange,
  onWorldNameChange,
  onStartGeneration,
  onPauseGeneration
}) => {
  const [canStart, setCanStart] = useState(true)
  const [estimatedSize, setEstimatedSize] = useState('')

  useEffect(() => {
    updateEstimatedSize()
    validateCoordinates()
  }, [minX, maxX, minY, maxY])

  const updateEstimatedSize = () => {
    const chunkCount = (maxX - minX + 1) * (maxY - minY + 1)
    // Each chunk has 256 tiles, each tile has roughly 100 bytes of data (biome, elevation, etc.)
    const estimatedSizeBytes = chunkCount * 16 * 16 * 100 // More realistic estimation
    const estimatedSizeMB = (estimatedSizeBytes / (1024 * 1024)).toFixed(1)
    setEstimatedSize(`${estimatedSizeMB} MB`)
  }

  const validateCoordinates = () => {
    // Only validate that coordinates make sense (max >= min)
    setCanStart(maxX >= minX && maxY >= minY)
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    const numValue = parseInt(value, 10)
    
    if (!isNaN(numValue)) {
      onCoordinateChange({ [name]: numValue })
    }
  }

  const handleWorldNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onWorldNameChange(event.target.value)
  }

  const chunkCount = (maxX - minX + 1) * (maxY - minY + 1)

  return (
    <div className="controls-container">
      <div className="coordinate-grid">
        <div className="input-group">
          <label htmlFor="minX">Min Chunk X</label>
          <input
            type="number"
            id="minX"
            name="minX"
            value={minX.toString()}
            onChange={handleInputChange}
            min="-1000"
            max="1000"
            required
          />
        </div>
        <div className="input-group">
          <label htmlFor="maxX">Max Chunk X</label>
          <input
            type="number"
            id="maxX"
            name="maxX"
            value={maxX.toString()}
            onChange={handleInputChange}
            min="-1000"
            max="1000"
            required
          />
        </div>
        <div className="input-group">
          <label htmlFor="minY">Min Chunk Y</label>
          <input
            type="number"
            id="minY"
            name="minY"
            value={minY.toString()}
            onChange={handleInputChange}
            min="-1000"
            max="1000"
            required
          />
        </div>
        <div className="input-group">
          <label htmlFor="maxY">Max Chunk Y</label>
          <input
            type="number"
            id="maxY"
            name="maxY"
            value={maxY.toString()}
            onChange={handleInputChange}
            min="-1000"
            max="1000"
            required
          />
        </div>
      </div>

      <div className="world-name-group">
        <div className="input-group">
          <label htmlFor="worldName">World Name (optional)</label>
          <input
            type="text"
            id="worldName"
            name="worldName"
            value={worldName}
            onChange={handleWorldNameChange}
            placeholder="Leave empty for random seed"
          />
        </div>
      </div>

      <div className="button-group">
        <button
          className="start-button"
          onClick={onStartGeneration}
          disabled={!canStart || isGenerating}
        >
          {isGenerating && !isPaused ? '🌍 Generating...' : '🌍 Start Generation'}
        </button>
        <button
          className="pause-button"
          onClick={onPauseGeneration}
          disabled={!isGenerating}
        >
          {isPaused ? '▶️ Resume' : '⏸️ Pause'}
        </button>
      </div>

      <div className="info-section">
        <div className="info-row">
          <span>Chunks:</span>
          <span>{chunkCount} chunks ({chunkCount * 16 * 16} tiles)</span>
        </div>
        <div className="info-row">
          <span>Area:</span>
          <span>{(maxX - minX + 1) * 16} × {(maxY - minY + 1) * 16} tiles</span>
        </div>
      </div>

      {statusMessage && (
        <div className="status-message">{statusMessage}</div>
      )}
    </div>
  )
}

export default ControlPanel