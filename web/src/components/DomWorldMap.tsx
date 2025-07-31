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
  const renderingRef = useRef<boolean>(false)
  const renderFrameRef = useRef<number | null>(null)
  
  // State for progressive rendering
  const [renderedTiles, setRenderedTiles] = useState<JSX.Element[]>([])
  const [isRendering, setIsRendering] = useState(false)
  const [renderProgress, setRenderProgress] = useState({ rendered: 0, total: 0 })
  
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

  // Progressive rendering effect
  useEffect(() => {
    if (!boundsRef.current || chunks.size === 0) {
      setRenderedTiles([])
      setRenderProgress({ rendered: 0, total: 0 })
      return
    }

    // Cancel any ongoing rendering
    if (renderFrameRef.current) {
      cancelAnimationFrame(renderFrameRef.current)
    }

    renderingRef.current = true
    setIsRendering(true)
    setRenderedTiles([])

    const { minX, maxX, minY, maxY } = boundsRef.current
    
    // Ensure container size is set when we start rendering
    const container = containerRef.current
    if (container) {
      const widthChunks = maxX - minX + 1
      const heightChunks = maxY - minY + 1
      const totalWidth = widthChunks * chunkSize * tileSize
      const totalHeight = heightChunks * chunkSize * tileSize
      
      container.style.width = `${totalWidth}px`
      container.style.height = `${totalHeight}px`
      container.style.setProperty('--tile-size', `${tileSize}px`)
      container.style.setProperty('--chunk-size', `${chunkSize}`)
      container.style.setProperty('--map-width', `${widthChunks * chunkSize}`)
      container.style.setProperty('--map-height', `${heightChunks * chunkSize}`)
    }

    const chunksArray = Array.from(chunks.entries())
    const totalTiles = chunksArray.reduce((sum, [_, chunkData]) => {
      return sum + Object.keys(chunkData).length
    }, 0)
    
    setRenderProgress({ rendered: 0, total: totalTiles })
    
    let chunkIndex = 0
    let tileIndex = 0
    let renderedCount = 0
    const batchSize = 100 // Render 100 tiles per frame
    const newTiles: JSX.Element[] = []

    const renderBatch = () => {
      const batchStart = performance.now()
      let tilesInBatch = 0

      while (chunkIndex < chunksArray.length && tilesInBatch < batchSize) {
        const [chunkKey, chunkData] = chunksArray[chunkIndex]
        const [chunkX, chunkY] = chunkKey.split(',').map(Number)
        const tileKeys = Object.keys(chunkData)

        while (tileIndex < tileKeys.length && tilesInBatch < batchSize) {
          const tileKey = parseInt(tileKeys[tileIndex])
          const tile = chunkData[tileKey]
          
          if (tile && tile.biome) {
            const y = Math.floor(tileKey / chunkSize)
            const x = tileKey % chunkSize
            const globalX = (chunkX - minX) * chunkSize + x
            const globalY = (chunkY - minY) * chunkSize + y
            const color = getBiomeColor(tile.biome as BiomeKey, tile.elevation)
            
            const handleTileHover = (event: React.MouseEvent) => {
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
            
            newTiles.push(
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
            
            renderedCount++
            tilesInBatch++
          }
          
          tileIndex++
        }

        if (tileIndex >= tileKeys.length) {
          chunkIndex++
          tileIndex = 0
        }
      }

      // Update rendered tiles and progress
      setRenderedTiles([...newTiles])
      setRenderProgress({ rendered: renderedCount, total: totalTiles })

      // Continue rendering if there are more chunks and we haven't been cancelled
      if (chunkIndex < chunksArray.length && renderingRef.current) {
        // Yield control back to browser if we've been rendering for more than 16ms
        const elapsed = performance.now() - batchStart
        const delay = elapsed > 16 ? 0 : Math.max(0, 16 - elapsed)
        
        renderFrameRef.current = requestAnimationFrame(() => {
          setTimeout(renderBatch, delay)
        })
      } else {
        // Rendering complete
        setIsRendering(false)
        renderingRef.current = false
        renderFrameRef.current = null
      }
    }

    // Start rendering
    renderBatch()

    // Cleanup function
    return () => {
      renderingRef.current = false
      if (renderFrameRef.current) {
        cancelAnimationFrame(renderFrameRef.current)
        renderFrameRef.current = null
      }
    }
  }, [chunks, chunkSize, tileSize, getBiomeColor])

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

  const hasChunks = chunks.size > 0

  return (
    <div className="dom-map-container">
      {hasChunks ? (
        <div 
          ref={containerRef}
          className={`dom-world-map ${isRendering ? 'rendering' : ''}`}
        >
          {renderedTiles}
        </div>
      ) : (
        <div className="map-placeholder">
          {isGenerating ? 
            '🌍 Generating chunks...' : 
            '🗺️ Click "Start Generation" to create a world'
          }
        </div>
      )}
      
      {(isGenerating || isRendering) && (
        <div className="progress-info">
          {isGenerating ? (
            `Loading chunks... ${chunks.size} loaded`
          ) : isRendering ? (
            `Rendering tiles... ${renderProgress.rendered}/${renderProgress.total} (${Math.round((renderProgress.rendered / renderProgress.total) * 100)}%)`
          ) : null}
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