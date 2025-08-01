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
 * DOM-based world map component with fixed-size grid and placeholder tiles
 * Eliminates flickering and zoom issues by pre-creating stable layout
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
  const tileCreationRef = useRef<{ 
    isCreating: boolean
    cancelToken: { cancelled: boolean }
    currentIndex: number
    totalTiles: number
  }>({ isCreating: false, cancelToken: { cancelled: false }, currentIndex: 0, totalTiles: 0 })
  
  // State for bounds to trigger re-render
  const [bounds, setBounds] = useState<{ minX: number, maxX: number, minY: number, maxY: number } | null>(null)
  
  // State for tile creation progress
  const [tileCreationProgress, setTileCreationProgress] = useState<{
    isCreating: boolean
    current: number
    total: number
    percentage: number
  }>({
    isCreating: false,
    current: 0,
    total: 0,
    percentage: 0
  })
  
  // State for tooltip only
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

  // Create placeholder tiles progressively when bounds are set
  const createPlaceholderTilesProgressively = useCallback(async () => {
    if (!bounds || !containerRef.current) return

    const { minX, maxX, minY, maxY } = bounds
    const container = containerRef.current
    
    // Clear existing tiles and cancel any ongoing creation
    container.innerHTML = ''
    tilesMapRef.current.clear()
    
    // Cancel previous tile creation if running
    if (tileCreationRef.current.isCreating) {
      tileCreationRef.current.cancelToken.cancelled = true
    }

    // Set container size upfront - this is fixed and won't change
    const widthChunks = maxX - minX + 1
    const heightChunks = maxY - minY + 1
    const totalWidth = widthChunks * chunkSize * tileSize
    const totalHeight = heightChunks * chunkSize * tileSize
    const totalTiles = widthChunks * heightChunks * chunkSize * chunkSize
    
    container.style.width = `${totalWidth}px`
    container.style.height = `${totalHeight}px`

    // Set up new creation session
    const cancelToken = { cancelled: false }
    tileCreationRef.current = {
      isCreating: true,
      cancelToken,
      currentIndex: 0,
      totalTiles
    }

    setTileCreationProgress({
      isCreating: true,
      current: 0,
      total: totalTiles,
      percentage: 0
    })

    // Create tiles progressively in batches
    const batchSize = 100 // Create 100 tiles per frame for smooth rendering
    let tilesCreated = 0
    
    const createBatch = () => {
      if (cancelToken.cancelled) {
        // Creation was cancelled
        setTileCreationProgress({
          isCreating: false,
          current: 0,
          total: 0,
          percentage: 0
        })
        return
      }

      const batchStart = performance.now()
      let batchCount = 0
      
      // Create tiles up to batch size or until done
      while (batchCount < batchSize && tilesCreated < totalTiles) {
        // Calculate tile coordinates
        const tilesPerRow = widthChunks * chunkSize
        const globalY = Math.floor(tilesCreated / tilesPerRow)
        const globalX = tilesCreated % tilesPerRow
        
        // Calculate chunk and local coordinates
        const chunkX = minX + Math.floor(globalX / chunkSize)
        const chunkY = minY + Math.floor(globalY / chunkSize)
        const localX = globalX % chunkSize
        const localY = globalY % chunkSize
        
        const tileKey = `${globalX}-${globalY}`
        
        const tileElement = document.createElement('div')
        tileElement.className = 'world-tile placeholder'
        tileElement.style.position = 'absolute'
        tileElement.style.left = `${globalX * tileSize}px`
        tileElement.style.top = `${globalY * tileSize}px`
        tileElement.style.width = `${tileSize}px`
        tileElement.style.height = `${tileSize}px`
        tileElement.style.backgroundColor = PLACEHOLDER_COLOR
        
        // Store tile data for interactions
        tileElement.dataset.tileX = globalX.toString()
        tileElement.dataset.tileY = globalY.toString()
        tileElement.dataset.chunkX = chunkX.toString()
        tileElement.dataset.chunkY = chunkY.toString()
        tileElement.dataset.localX = localX.toString()
        tileElement.dataset.localY = localY.toString()
        
        container.appendChild(tileElement)
        tilesMapRef.current.set(tileKey, tileElement)
        
        tilesCreated++
        batchCount++
      }
      
      // Update progress
      const percentage = Math.round((tilesCreated / totalTiles) * 100)
      setTileCreationProgress({
        isCreating: tilesCreated < totalTiles,
        current: tilesCreated,
        total: totalTiles,
        percentage
      })
      
      if (tilesCreated < totalTiles) {
        // Continue with next batch on next frame
        requestAnimationFrame(createBatch)
      } else {
        // Tile creation complete
        tileCreationRef.current.isCreating = false
        setTileCreationProgress({
          isCreating: false,
          current: totalTiles,
          total: totalTiles,
          percentage: 100
        })
      }
    }
    
    // Start creating tiles
    requestAnimationFrame(createBatch)
  }, [bounds, chunkSize, tileSize])

  // Create placeholder tiles when both bounds and container are available
  useEffect(() => {
    if (bounds && containerRef.current) {
      createPlaceholderTilesProgressively();
    }
  }, [createPlaceholderTilesProgressively]);

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
          
          // Update tile appearance without layout changes
          tileElement.style.backgroundColor = color
          tileElement.classList.remove('placeholder')
          
          // Store tile data for tooltip
          tileElement.dataset.biome = tile.biome
          tileElement.dataset.elevation = tile.elevation.toString()
          
          // Add event listeners for interaction
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
      // Cancel any ongoing tile creation
      if (tileCreationRef.current.isCreating) {
        tileCreationRef.current.cancelToken.cancelled = true
      }
      
      container.innerHTML = ''
      tilesMapRef.current.clear()
      
      // Reset creation progress
      setTileCreationProgress({
        isCreating: false,
        current: 0,
        total: 0,
        percentage: 0
      })
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
          className="dom-world-map simple-grid"
        />
      ) : (
        <div className="map-placeholder">
          {isGenerating ? 
            '🌍 Generating chunks...' : 
            '🗺️ Click "Start Generation" to create a world'
          }
        </div>
      )}
      
      {tileCreationProgress.isCreating && (
        <div className="progress-info tile-creation">
          🏗️ Creating map tiles... {tileCreationProgress.current.toLocaleString()}/{tileCreationProgress.total.toLocaleString()} ({tileCreationProgress.percentage}%)
        </div>
      )}
      
      {isGenerating && !tileCreationProgress.isCreating && (
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