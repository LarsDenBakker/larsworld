import React, { useRef, useCallback, forwardRef, useImperativeHandle, useState, useEffect } from 'react'
import TileTooltip from './TileTooltip'
import { generateChunkPNG, getTileFromImageClick, getTileData } from './ChunkPNGGenerator'
import './DomWorldMap.css'

interface ChunkData {
  [key: number]: {
    biome: string
    elevation: number
  }
}

interface PngWorldMapProps {
  chunks: Map<string, ChunkData>
  isGenerating: boolean
  chunkSize?: number
  tileSize?: number
}

interface PngWorldMapRef {
  setMapSize: (minX: number, maxX: number, minY: number, maxY: number) => void
  addChunk: (chunkX: number, chunkY: number, chunkData: ChunkData, minX: number, minY: number) => void
  clear: () => void
}

/**
 * PNG-based world map component for optimal performance
 * Uses pre-generated PNG images for chunks instead of individual DOM tiles
 */
const PngWorldMap = forwardRef<PngWorldMapRef, PngWorldMapProps>(({ 
  chunks, 
  isGenerating, 
  chunkSize = 16, 
  tileSize = 6 
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const boundsRef = useRef<{ minX: number, maxX: number, minY: number, maxY: number } | null>(null)
  const chunkImagesRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const chunkPNGsRef = useRef<Map<string, string>>(new Map())
  
  // State for bounds to trigger re-render
  const [bounds, setBounds] = useState<{ minX: number, maxX: number, minY: number, maxY: number } | null>(null)
  const [renderingProgress, setRenderingProgress] = useState<{ current: number, total: number } | null>(null)
  
  // Single tooltip state
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

  // Create complete grid structure instantly when bounds are set
  const createStaticGrid = useCallback(() => {
    if (!bounds || !containerRef.current) return

    const { minX, maxX, minY, maxY } = bounds
    const container = containerRef.current
    
    // Clear existing content
    container.innerHTML = ''
    chunkImagesRef.current.clear()

    // Calculate grid dimensions in chunks
    const widthChunks = maxX - minX + 1
    const heightChunks = maxY - minY + 1
    const chunkDisplaySize = chunkSize * tileSize // Size of each chunk in pixels

    // Set up CSS Grid container for chunks (same as before but with images)
    container.style.display = 'grid'
    container.style.gridTemplateColumns = `repeat(${widthChunks}, ${chunkDisplaySize}px)`
    container.style.gridTemplateRows = `repeat(${heightChunks}, ${chunkDisplaySize}px)`
    container.style.gap = '2px' // Gap between chunks
    container.style.padding = '20px'
    container.style.overflow = 'auto'
    container.style.width = '100%'
    container.style.height = '100%'
    container.style.boxSizing = 'border-box'

    // Create chunk image containers (much fewer DOM nodes than individual tiles)
    for (let chunkY = minY; chunkY <= maxY; chunkY++) {
      for (let chunkX = minX; chunkX <= maxX; chunkX++) {
        const chunkKey = `chunk-${chunkX}-${chunkY}`
        
        const chunkContainer = document.createElement('div')
        chunkContainer.className = 'png-chunk-container'
        chunkContainer.style.width = `${chunkDisplaySize}px`
        chunkContainer.style.height = `${chunkDisplaySize}px`
        chunkContainer.style.position = 'relative'
        chunkContainer.style.backgroundColor = '#e5e7eb' // Placeholder gray
        
        // Create image element for chunk
        const imgElement = document.createElement('img')
        imgElement.style.width = '100%'
        imgElement.style.height = '100%'
        imgElement.style.imageRendering = 'pixelated' // Crisp pixel art rendering
        imgElement.style.imageRendering = 'crisp-edges'
        imgElement.style.cursor = 'pointer'
        imgElement.style.display = 'none' // Hidden until PNG is loaded
        
        // Store chunk data for event handling
        imgElement.dataset.chunkX = chunkX.toString()
        imgElement.dataset.chunkY = chunkY.toString()
        
        // Add click event listener for tooltip
        imgElement.addEventListener('click', (event: MouseEvent) => {
          const rect = imgElement.getBoundingClientRect()
          const clickX = event.clientX - rect.left
          const clickY = event.clientY - rect.top
          
          // Convert image-relative coordinates to tile coordinates
          const imageWidth = rect.width
          const imageHeight = rect.height
          const tilePixelX = (clickX / imageWidth) * (chunkSize * tileSize)
          const tilePixelY = (clickY / imageHeight) * (chunkSize * tileSize)
          
          const { localX, localY } = getTileFromImageClick(tilePixelX, tilePixelY, chunkSize, tileSize)
          
          // Get chunk data and tile data
          const chunkDataKey = `${chunkX},${chunkY}`
          const chunkData = chunks.get(chunkDataKey)
          if (chunkData) {
            const tileData = getTileData(chunkData, localX, localY, chunkSize)
            if (tileData) {
              const globalX = (chunkX - bounds.minX) * chunkSize + localX
              const globalY = (chunkY - bounds.minY) * chunkSize + localY
              
              setTooltip({
                visible: true,
                x: event.clientX,
                y: event.clientY,
                tileData: {
                  biome: tileData.biome,
                  elevation: tileData.elevation,
                  worldX: globalX,
                  worldY: globalY,
                  chunkX: chunkX,
                  chunkY: chunkY,
                  localX: localX,
                  localY: localY
                }
              })
            }
          }
        })
        
        chunkContainer.appendChild(imgElement)
        container.appendChild(chunkContainer)
        chunkImagesRef.current.set(chunkKey, imgElement)
      }
    }
  }, [bounds, chunkSize, tileSize, chunks])

  // Create grid when bounds are available
  useEffect(() => {
    if (bounds && containerRef.current) {
      createStaticGrid();
    }
  }, [createStaticGrid]);

  // Generate PNGs and update images when chunks change
  useEffect(() => {
    if (!bounds || chunks.size === 0) return

    // Track which chunks need PNG generation
    const chunksNeedingPNG = new Map<string, ChunkData>()
    
    chunks.forEach((chunkData, chunkKey) => {
      if (!chunkPNGsRef.current.has(chunkKey)) {
        chunksNeedingPNG.set(chunkKey, chunkData)
      }
    })
    
    if (chunksNeedingPNG.size === 0) return
    
    // Generate PNGs for new chunks with progress feedback
    setRenderingProgress({ current: 0, total: chunksNeedingPNG.size })
    
    const generatePNGs = async () => {
      const chunks = Array.from(chunksNeedingPNG.entries())
      const batchSize = 20 // Increase batch size since PNG generation is fast
      
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize)
        
        // Pre-generate all PNGs in the batch (fast, synchronous operation)
        const batchResults: Array<{ chunkKey: string, pngDataUrl: string, chunkX: number, chunkY: number }> = []
        
        for (const [chunkKey, chunkData] of batch) {
          try {
            const pngDataUrl = generateChunkPNG(chunkData, chunkSize, tileSize)
            chunkPNGsRef.current.set(chunkKey, pngDataUrl)
            
            const [chunkX, chunkY] = chunkKey.split(',').map(Number)
            batchResults.push({ chunkKey, pngDataUrl, chunkX, chunkY })
          } catch (error) {
            console.error(`Failed to generate PNG for chunk ${chunkKey}:`, error)
          }
        }
        
        // Apply all DOM updates in a single batch to minimize reflows
        batchResults.forEach(({ pngDataUrl, chunkX, chunkY }) => {
          const imgKey = `chunk-${chunkX}-${chunkY}`
          const imgElement = chunkImagesRef.current.get(imgKey)
          
          if (imgElement) {
            // Use requestAnimationFrame to batch DOM updates
            requestAnimationFrame(() => {
              imgElement.src = pngDataUrl
              imgElement.style.display = 'block'
              imgElement.parentElement!.style.backgroundColor = 'transparent'
            })
          }
        })
        
        // Update progress
        const processed = Math.min(i + batchSize, chunks.length)
        setRenderingProgress({ current: processed, total: chunks.length })
        
        // Yield control to browser to keep UI responsive
        if (i + batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
      }
      
      // Clear progress when done
      setRenderingProgress(null)
    }
    
    generatePNGs()
  }, [chunks, bounds, chunkSize, tileSize])

  const setMapSize = useCallback((minX: number, maxX: number, minY: number, maxY: number) => {
    boundsRef.current = { minX, maxX, minY, maxY }
    setBounds({ minX, maxX, minY, maxY })
  }, [])

  const addChunk = useCallback((chunkX: number, chunkY: number, chunkData: ChunkData, minX: number, minY: number) => {
    // Chunks are handled automatically via the chunks prop and useEffect
  }, [])

  const clear = useCallback(() => {
    const container = containerRef.current
    if (container) {
      container.innerHTML = ''
      chunkImagesRef.current.clear()
      chunkPNGsRef.current.clear()
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
          className="dom-world-map png-chunk-grid"
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
          {renderingProgress && (
            <div>🎨 Rendering images... {renderingProgress.current}/{renderingProgress.total}</div>
          )}
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

PngWorldMap.displayName = 'PngWorldMap'

export default PngWorldMap