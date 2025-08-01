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

    // Calculate grid dimensions
    const widthChunks = maxX - minX + 1
    const heightChunks = maxY - minY + 1
    const totalCols = widthChunks * chunkSize
    const totalRows = heightChunks * chunkSize

    // Set up CSS Grid container
    container.style.display = 'grid'
    container.style.gridTemplateColumns = `repeat(${totalCols}, ${tileSize}px)`
    container.style.gridTemplateRows = `repeat(${totalRows}, ${tileSize}px)`
    container.style.gap = '1px' // CSS grid gap for separators
    container.style.padding = '20px'
    container.style.overflow = 'auto'
    container.style.width = '100%'
    container.style.height = '100%'
    container.style.boxSizing = 'border-box'

    // Create all tiles at once (no progressive creation)
    for (let globalY = 0; globalY < totalRows; globalY++) {
      for (let globalX = 0; globalX < totalCols; globalX++) {
        // Calculate chunk and local coordinates
        const chunkX = minX + Math.floor(globalX / chunkSize)
        const chunkY = minY + Math.floor(globalY / chunkSize)
        const localX = globalX % chunkSize
        const localY = globalY % chunkSize
        
        const tileKey = `${globalX}-${globalY}`
        
        const tileElement = document.createElement('div')
        tileElement.className = 'world-tile'
        // No background color initially - invisible placeholder
        
        // Store tile data for interactions
        tileElement.dataset.tileX = globalX.toString()
        tileElement.dataset.tileY = globalY.toString()
        tileElement.dataset.chunkX = chunkX.toString()
        tileElement.dataset.chunkY = chunkY.toString()
        tileElement.dataset.localX = localX.toString()
        tileElement.dataset.localY = localY.toString()
        
        container.appendChild(tileElement)
        tilesMapRef.current.set(tileKey, tileElement)
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
      
      // Update each tile in the chunk
      Object.entries(chunkData).forEach(([tileIndex, tile]) => {
        const tileKey = parseInt(tileIndex)
        const localY = Math.floor(tileKey / chunkSize)
        const localX = tileKey % chunkSize
        const globalX = (chunkX - minX) * chunkSize + localX
        const globalY = (chunkY - minY) * chunkSize + localY
        const tileElementKey = `${globalX}-${globalY}`
        
        const tileElement = tilesMapRef.current.get(tileElementKey)
        if (tileElement && tile.biome) {
          const color = getBiomeColor(tile.biome as BiomeKey, tile.elevation)
          
          // Paint tile with biome color
          tileElement.style.backgroundColor = color
          tileElement.classList.add('painted')
          
          // Store tile data for tooltip
          tileElement.dataset.biome = tile.biome
          tileElement.dataset.elevation = tile.elevation.toString()
          
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
          
          // Remove old listeners and add new ones
          tileElement.removeEventListener('mouseenter', handleTileHover as any)
          tileElement.removeEventListener('mouseleave', handleTileLeave as any)
          tileElement.removeEventListener('click', handleTileClick as any)
          
          tileElement.addEventListener('mouseenter', handleTileHover)
          tileElement.addEventListener('mouseleave', handleTileLeave)
          tileElement.addEventListener('click', handleTileClick)
        }
      })
    })
  }, [chunks, chunkSize, getBiomeColor, bounds])

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
          className="dom-world-map css-grid"
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