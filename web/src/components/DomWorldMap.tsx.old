import React, { useRef, useCallback, forwardRef, useImperativeHandle, useState, useEffect } from 'react'
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

// Fixed placeholder color for unloaded tiles
const PLACEHOLDER_COLOR = '#e5e7eb'

/**
 * DOM-based world map component using CSS Grid for optimal performance
 * Creates static grid structure instantly, then paints chunks progressively
 */
const DomWorldMap = forwardRef<DomWorldMapRef, DomWorldMapProps>(({ 
  chunks, 
  isGenerating, 
  chunkSize = 16, 
  tileSize = 6 
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const boundsRef = useRef<{ minX: number, maxX: number, minY: number, maxY: number } | null>(null)
  const tilesMapRef = useRef<Map<string, HTMLDivElement>>(new Map())
  
  // State for bounds to trigger re-render
  const [bounds, setBounds] = useState<{ minX: number, maxX: number, minY: number, maxY: number } | null>(null)
  
  // Single tooltip state and DOM node
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

  // Create complete grid structure instantly when bounds are set
  const createStaticGrid = useCallback(() => {
    if (!bounds || !containerRef.current) return

    const { minX, maxX, minY, maxY } = bounds
    const container = containerRef.current
    
    // Clear existing tiles
    container.innerHTML = ''
    tilesMapRef.current.clear()

    // Calculate grid dimensions in chunks (not individual tiles)
    const widthChunks = maxX - minX + 1
    const heightChunks = maxY - minY + 1
    const chunkDisplaySize = chunkSize * tileSize // Size of each chunk in pixels

    // Set up CSS Grid container for chunks
    container.style.display = 'grid'
    container.style.gridTemplateColumns = `repeat(${widthChunks}, ${chunkDisplaySize}px)`
    container.style.gridTemplateRows = `repeat(${heightChunks}, ${chunkDisplaySize}px)`
    container.style.gap = '2px' // Gap between chunks
    container.style.padding = '20px'
    container.style.overflow = 'auto'
    container.style.width = '100%'
    container.style.height = '100%'
    container.style.boxSizing = 'border-box'

    // Create chunk containers (much fewer DOM nodes)
    for (let chunkY = minY; chunkY <= maxY; chunkY++) {
      for (let chunkX = minX; chunkX <= maxX; chunkX++) {
        const chunkKey = `chunk-${chunkX}-${chunkY}`
        
        const chunkElement = document.createElement('div')
        chunkElement.className = 'chunk-container'
        chunkElement.style.width = `${chunkDisplaySize}px`
        chunkElement.style.height = `${chunkDisplaySize}px`
        chunkElement.style.position = 'relative'
        // No background initially - invisible placeholder
        
        // Store chunk data
        chunkElement.dataset.chunkX = chunkX.toString()
        chunkElement.dataset.chunkY = chunkY.toString()
        
        container.appendChild(chunkElement)
        tilesMapRef.current.set(chunkKey, chunkElement)
      }
    }
  }, [bounds, chunkSize, tileSize])

  // Create grid when bounds are available
  useEffect(() => {
    if (bounds && containerRef.current) {
      createStaticGrid();
    }
  }, [createStaticGrid]);

  // Update tiles when chunks change
  useEffect(() => {
    if (!bounds || chunks.size === 0) return

    const { minX, minY } = bounds

    // Update each chunk's tiles
    chunks.forEach((chunkData, chunkKey) => {
      const [chunkX, chunkY] = chunkKey.split(',').map(Number)
      const chunkElementKey = `chunk-${chunkX}-${chunkY}`
      
      const chunkElement = tilesMapRef.current.get(chunkElementKey)
      if (chunkElement) {
        // Create a tile grid within this chunk using CSS Grid
        chunkElement.innerHTML = '' // Clear any existing content
        chunkElement.style.display = 'grid'
        chunkElement.style.gridTemplateColumns = `repeat(${chunkSize}, ${tileSize}px)`
        chunkElement.style.gridTemplateRows = `repeat(${chunkSize}, ${tileSize}px)`
        chunkElement.style.gap = '1px'
        
        // Create tiles within this chunk
        Object.entries(chunkData).forEach(([tileIndex, tile]) => {
          const tileKey = parseInt(tileIndex)
          const localY = Math.floor(tileKey / chunkSize)
          const localX = tileKey % chunkSize
          const globalX = (chunkX - minX) * chunkSize + localX
          const globalY = (chunkY - minY) * chunkSize + localY
          
          if (tile.biome) {
            const color = getBiomeColor(tile.biome as BiomeKey, tile.elevation)
            
            const tileElement = document.createElement('div')
            tileElement.className = 'world-tile painted'
            tileElement.style.backgroundColor = color
            tileElement.style.width = `${tileSize}px`
            tileElement.style.height = `${tileSize}px`
            
            // Store tile data for tooltip
            tileElement.dataset.biome = tile.biome
            tileElement.dataset.elevation = tile.elevation.toString()
            tileElement.dataset.tileX = globalX.toString()
            tileElement.dataset.tileY = globalY.toString()
            tileElement.dataset.chunkX = chunkX.toString()
            tileElement.dataset.chunkY = chunkY.toString()
            tileElement.dataset.localX = localX.toString()
            tileElement.dataset.localY = localY.toString()
            
            // Add event listeners for interaction with single tooltip
            const handleTileHover = (event: MouseEvent) => {
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
                  localX: localX,
                  localY: localY
                }
              })
            }
            
            const handleTileLeave = () => {
              setTooltip(prev => ({ ...prev, visible: false }))
            }
            
            const handleTileClick = (event: MouseEvent) => {
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
                  localX: localX,
                  localY: localY
                }
              }))
            }
            
            tileElement.addEventListener('mouseenter', handleTileHover)
            tileElement.addEventListener('mouseleave', handleTileLeave)
            tileElement.addEventListener('click', handleTileClick)
            
            chunkElement.appendChild(tileElement)
          }
        })
      }
    })
  }, [chunks, chunkSize, getBiomeColor, bounds, tileSize])

  const setMapSize = useCallback((minX: number, maxX: number, minY: number, maxY: number) => {
    boundsRef.current = { minX, maxX, minY, maxY }
    
    // Set bounds state to trigger re-render and useEffect
    setBounds({ minX, maxX, minY, maxY })
  }, [])

  const addChunk = useCallback((chunkX: number, chunkY: number, chunkData: ChunkData, minX: number, minY: number) => {
    // Chunks are handled automatically via the chunks prop and useEffect
  }, [])

  const clear = useCallback(() => {
    const container = containerRef.current
    if (container) {
      container.innerHTML = ''
      tilesMapRef.current.clear()
    }
  }, [])

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    setMapSize,
    addChunk,
    clear
  }), [setMapSize, addChunk, clear])

  const hasMapArea = bounds !== null

  return (
    <div className="dom-map-container">
      {hasMapArea ? (
        <div 
          ref={containerRef}
          className="dom-world-map chunk-grid"
        />
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
          🌍 Loading chunks... {chunks.size} loaded
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