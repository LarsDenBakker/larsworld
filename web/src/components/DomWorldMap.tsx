import React, { useRef, useCallback, forwardRef, useImperativeHandle, useMemo, useState, useEffect } from 'react'
import TileTooltip from './TileTooltip'
import './DomWorldMap.css'

interface ChunkData {
  [key: number]: {
    biome: string
    elevation: number
  }
}

interface DomWorldMapProps {
  chunks: Map<string, ChunkData>
  isGenerating: boolean
  chunkSize?: number
  tileSize?: number
}

interface DomWorldMapRef {
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
 * DOM-based world map component for rendering chunks using HTML/CSS
 * Alternative to canvas rendering for performance comparison
 */
const DomWorldMap = forwardRef<DomWorldMapRef, DomWorldMapProps>(({ 
  chunks, 
  isGenerating, 
  chunkSize = 16, 
  tileSize = 6 
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const boundsRef = useRef<{ minX: number, maxX: number, minY: number, maxY: number } | null>(null)
  
  // State for tooltip
  const [tooltip, setTooltip] = useState<{
    visible: boolean
    x: number
    y: number
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
  }>({
    visible: false,
    x: 0,
    y: 0,
    tileData: null
  })

  // Clear tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setTooltip(prev => ({ ...prev, visible: false }))
      }
    }
    
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const setMapSize = useCallback((minX: number, maxX: number, minY: number, maxY: number) => {
    boundsRef.current = { minX, maxX, minY, maxY }
    
    const container = containerRef.current
    if (!container) return

    const widthChunks = maxX - minX + 1
    const heightChunks = maxY - minY + 1
    const totalWidth = widthChunks * chunkSize * tileSize
    const totalHeight = heightChunks * chunkSize * tileSize
    
    // Set container size and CSS custom properties for grid layout
    container.style.width = `${totalWidth}px`
    container.style.height = `${totalHeight}px`
    container.style.setProperty('--tile-size', `${tileSize}px`)
    container.style.setProperty('--chunk-size', `${chunkSize}`)
    container.style.setProperty('--map-width', `${widthChunks * chunkSize}`)
    container.style.setProperty('--map-height', `${heightChunks * chunkSize}`)
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
    // For DOM rendering, chunks are rendered through React state updates
    // The actual rendering happens in the render method below
  }, [])

  const clear = useCallback(() => {
    const container = containerRef.current
    if (container) {
      container.innerHTML = ''
    }
  }, [])

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    setMapSize,
    addChunk,
    clear
  }), [setMapSize, addChunk, clear])

  // Generate tiles for all loaded chunks
  const tiles = useMemo(() => {
    if (!boundsRef.current || chunks.size === 0) return []

    const { minX, minY } = boundsRef.current
    const tileElements: JSX.Element[] = []
    
    chunks.forEach((chunkData, chunkKey) => {
      const [chunkX, chunkY] = chunkKey.split(',').map(Number)
      
      for (let y = 0; y < chunkSize; y++) {
        for (let x = 0; x < chunkSize; x++) {
          const tileIndex = y * chunkSize + x
          const tile = chunkData[tileIndex]
          
          if (tile && tile.biome) {
            const globalX = (chunkX - minX) * chunkSize + x
            const globalY = (chunkY - minY) * chunkSize + y
            const color = getBiomeColor(tile.biome as BiomeKey, tile.elevation)
            
            const handleTileHover = (event: React.MouseEvent) => {
              const rect = event.currentTarget.getBoundingClientRect()
              const clientX = event.clientX
              const clientY = event.clientY
              
              setTooltip({
                visible: true,
                x: clientX,
                y: clientY,
                tileData: {
                  biome: tile.biome,
                  elevation: tile.elevation,
                  worldX: globalX,
                  worldY: globalY,
                  chunkX: chunkX,
                  chunkY: chunkY,
                  localX: x,
                  localY: y
                }
              })
            }
            
            const handleTileLeave = () => {
              setTooltip(prev => ({ ...prev, visible: false }))
            }
            
            const handleTileClick = (event: React.MouseEvent) => {
              // For touch devices or when tooltip is not visible, show tooltip on click
              const rect = event.currentTarget.getBoundingClientRect()
              const clientX = event.clientX
              const clientY = event.clientY
              
              setTooltip(prev => ({
                visible: !prev.visible || prev.tileData?.worldX !== globalX || prev.tileData?.worldY !== globalY,
                x: clientX,
                y: clientY,
                tileData: {
                  biome: tile.biome,
                  elevation: tile.elevation,
                  worldX: globalX,
                  worldY: globalY,
                  chunkX: chunkX,
                  chunkY: chunkY,
                  localX: x,
                  localY: y
                }
              }))
            }
            
            tileElements.push(
              <div
                key={`tile-${globalX}-${globalY}`}
                className="world-tile"
                style={{
                  backgroundColor: color,
                  gridColumn: globalX + 1,
                  gridRow: globalY + 1
                }}
                onMouseEnter={handleTileHover}
                onMouseLeave={handleTileLeave}
                onClick={handleTileClick}
                data-tile-x={globalX}
                data-tile-y={globalY}
              />
            )
          }
        }
      }
    })
    
    return tileElements
  }, [chunks, chunkSize, getBiomeColor])

  const hasChunks = chunks.size > 0

  return (
    <div className="dom-map-container">
      {hasChunks ? (
        <div 
          ref={containerRef}
          className="dom-world-map"
        >
          {tiles}
        </div>
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
      
      <TileTooltip
        x={tooltip.x}
        y={tooltip.y}
        visible={tooltip.visible}
        tileData={tooltip.tileData}
      />
    </div>
  )
})

DomWorldMap.displayName = 'DomWorldMap'

export default DomWorldMap