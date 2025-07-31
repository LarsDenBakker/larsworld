import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import './WorldMap.css'

interface ChunkData {
  [key: number]: {
    biome: string
    elevation: number
  }
}

interface WorldMapProps {
  chunks: Map<string, ChunkData>
  isGenerating: boolean
  chunkSize?: number
  tileSize?: number
}

interface WorldMapRef {
  setMapSize: (minX: number, maxX: number, minY: number, maxY: number) => void
  addChunk: (chunkX: number, chunkY: number, chunkData: ChunkData, minX: number, minY: number) => void
  clear: () => void
}

type BiomeKey = 'deep_ocean' | 'shallow_ocean' | 'desert' | 'tundra' | 'arctic' | 'swamp' | 
               'grassland' | 'forest' | 'taiga' | 'savanna' | 'tropical_forest' | 'alpine'

const BIOME_COLORS: Record<BiomeKey, string> = {
  deep_ocean: '#4169e1',
  shallow_ocean: '#6496e6',
  desert: '#eecbad',
  tundra: '#b0c4de',
  arctic: '#f8f8ff',
  swamp: '#556b2f',
  grassland: '#7cfc00',
  forest: '#228b22',
  taiga: '#487648',
  savanna: '#bdb76b',
  tropical_forest: '#006400',
  alpine: '#a9a9a9'
}

/**
 * World map canvas component for rendering chunks
 */
const WorldMap = forwardRef<WorldMapRef, WorldMapProps>(({ 
  chunks, 
  isGenerating, 
  chunkSize = 16, 
  tileSize = 4 
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas && !contextRef.current) {
      contextRef.current = canvas.getContext('2d')
    }
  }, [])

  const setMapSize = useCallback((minX: number, maxX: number, minY: number, maxY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const widthChunks = maxX - minX + 1
    const heightChunks = maxY - minY + 1
    const totalWidth = widthChunks * chunkSize * tileSize
    const totalHeight = heightChunks * chunkSize * tileSize

    canvas.width = totalWidth
    canvas.height = totalHeight
    canvas.style.maxWidth = '100%'
    canvas.style.height = 'auto'

    // Clear canvas
    const context = contextRef.current
    if (context) {
      context.fillStyle = '#f3f4f6'
      context.fillRect(0, 0, totalWidth, totalHeight)
    }
  }, [chunkSize, tileSize])

  const getBiomeColor = useCallback((biome: BiomeKey, elevation = 0): string => {
    const baseColor = BIOME_COLORS[biome] || '#cccccc'
    
    // Apply elevation shading (darker = higher elevation)
    if (elevation > 0.5) {
      return darkenColor(baseColor, 0.3)
    } else if (elevation > 0.3) {
      return darkenColor(baseColor, 0.15)
    }
    
    return baseColor
  }, [])

  const darkenColor = (color: string, factor: number): string => {
    // Simple color darkening
    const hex = color.replace('#', '')
    const r = Math.floor(parseInt(hex.substr(0, 2), 16) * (1 - factor))
    const g = Math.floor(parseInt(hex.substr(2, 2), 16) * (1 - factor))
    const b = Math.floor(parseInt(hex.substr(4, 2), 16) * (1 - factor))
    
    return `rgb(${r}, ${g}, ${b})`
  }

  const addChunk = useCallback((chunkX: number, chunkY: number, chunkData: ChunkData, minX: number, minY: number) => {
    const context = contextRef.current
    if (!context || !chunkData) return

    const offsetX = (chunkX - minX) * chunkSize * tileSize
    const offsetY = (chunkY - minY) * chunkSize * tileSize

    // Add fade-in animation by using globalAlpha
    context.save()
    context.globalAlpha = 0.1

    // Gradually increase opacity for smooth fade-in
    let opacity = 0.1
    const fadeIn = () => {
      if (opacity >= 1) {
        context.restore()
        return
      }
      
      context.clearRect(offsetX, offsetY, 
                       chunkSize * tileSize, 
                       chunkSize * tileSize)
      context.globalAlpha = opacity
      
      for (let y = 0; y < chunkSize; y++) {
        for (let x = 0; x < chunkSize; x++) {
          const tileIndex = y * chunkSize + x
          const tile = chunkData[tileIndex]
          
          if (tile && tile.biome) {
            const color = getBiomeColor(tile.biome as BiomeKey, tile.elevation)
            context.fillStyle = color
            context.fillRect(
              offsetX + x * tileSize,
              offsetY + y * tileSize,
              tileSize,
              tileSize
            )
          }
        }
      }
      
      opacity += 0.1
      requestAnimationFrame(fadeIn)
    }
    
    fadeIn()
  }, [chunkSize, tileSize, getBiomeColor])

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    const context = contextRef.current
    if (context && canvas) {
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = '#f3f4f6'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
  }, [])

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    setMapSize,
    addChunk,
    clear
  }), [setMapSize, addChunk, clear])

  const renderMap = useCallback(() => {
    const context = contextRef.current
    if (!context) return

    chunks.forEach((chunkData, chunkKey) => {
      const [chunkX, chunkY] = chunkKey.split(',').map(Number)
      // Note: We'd need minX, minY passed in for proper rendering
      // This is a simplified version
      const offsetX = chunkX * chunkSize * tileSize
      const offsetY = chunkY * chunkSize * tileSize

      for (let y = 0; y < chunkSize; y++) {
        for (let x = 0; x < chunkSize; x++) {
          const tileIndex = y * chunkSize + x
          const tile = chunkData[tileIndex]
          
          if (tile && tile.biome) {
            const color = getBiomeColor(tile.biome as BiomeKey, tile.elevation)
            context.fillStyle = color
            context.fillRect(
              offsetX + x * tileSize,
              offsetY + y * tileSize,
              tileSize,
              tileSize
            )
          }
        }
      }
    })
  }, [chunks, chunkSize, tileSize, getBiomeColor])

  useEffect(() => {
    if (chunks.size > 0) {
      renderMap()
    }
  }, [chunks, renderMap])

  const hasChunks = chunks.size > 0

  return (
    <div className="map-container">
      {hasChunks ? (
        <canvas ref={canvasRef}></canvas>
      ) : (
        <div className="map-placeholder">
          {isGenerating ? 
            '🌍 Generating chunks...' : 
            '🗺️ Click "Start Generation" to create a world'
          }
        </div>
      )}
      
      {isGenerating && (
        <div className="progress-info">
          Loading chunks... {chunks.size} loaded
        </div>
      )}
    </div>
  )
})

WorldMap.displayName = 'WorldMap'

export default WorldMap