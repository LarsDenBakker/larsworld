import React, { useRef, useCallback, forwardRef, useImperativeHandle, useState, useEffect } from 'react'
import TileTooltip from './TileTooltip'
import { getBaseBiomePNGUrl, createElevationCSS } from './StaticBiomePNGGenerator'
import './DomWorldMap.css'

interface ChunkData {
  [key: number]: {
    biome: string
    elevation: number
  }
}

interface CSSGradientWorldMapProps {
  chunks: Map<string, ChunkData>
  isGenerating: boolean
  chunkSize?: number
  tileSize?: number
}

interface CSSGradientWorldMapRef {
  setMapSize: (minX: number, maxX: number, minY: number, maxY: number) => void
  addChunk: (chunkX: number, chunkY: number, chunkData: ChunkData, minX: number, minY: number) => void
  clear: () => void
}

/**
 * World map component using base biome PNGs with CSS gradients for elevation
 * This approach uses fewer PNG files (12 vs 132) and applies elevation effects via CSS
 */
const CSSGradientWorldMap = forwardRef<CSSGradientWorldMapRef, CSSGradientWorldMapProps>(({ 
  chunks, 
  isGenerating, 
  chunkSize = 16, 
  tileSize = 6 
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const boundsRef = useRef<{ minX: number, maxX: number, minY: number, maxY: number } | null>(null)
  const tileElementsRef = useRef<Map<string, HTMLImageElement>>(new Map())
  
  // State for bounds to trigger re-render
  const [bounds, setBounds] = useState<{ minX: number, maxX: number, minY: number, maxY: number } | null>(null)
  const [basePNGsLoaded, setBasePNGsLoaded] = useState(false)
  
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

  // Pre-load base biome PNGs when component mounts
  useEffect(() => {
    const loadBasePNGs = async () => {
      const biomes = [
        'deep_ocean', 'shallow_ocean', 'desert', 'tundra', 'arctic', 'swamp',
        'grassland', 'forest', 'taiga', 'savanna', 'tropical_forest', 'alpine'
      ]
      
      const loadPromises = biomes.map(biome => {
        return new Promise<void>((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve()
          img.onerror = () => reject(new Error(`Failed to load ${biome}`))
          img.src = getBaseBiomePNGUrl(biome)
        })
      })
      
      try {
        const startTime = performance.now()
        await Promise.all(loadPromises)
        const endTime = performance.now()
        
        console.log(`Pre-loaded ${biomes.length} base biome PNGs in ${Math.round(endTime - startTime)}ms`)
        setBasePNGsLoaded(true)
      } catch (error) {
        console.error('Failed to load base biome PNGs:', error)
      }
    }
    
    loadBasePNGs()
  }, [])

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
  const createCSSGradientGrid = useCallback(() => {
    if (!bounds || !containerRef.current || !basePNGsLoaded) return

    const { minX, maxX, minY, maxY } = bounds
    const container = containerRef.current
    
    // Clear existing content
    container.innerHTML = ''
    tileElementsRef.current.clear()

    // Calculate grid dimensions in tiles
    const widthChunks = maxX - minX + 1
    const heightChunks = maxY - minY + 1
    const widthTiles = widthChunks * chunkSize
    const heightTiles = heightChunks * chunkSize

    // Set up CSS Grid container for individual tiles
    container.style.display = 'grid'
    container.style.gridTemplateColumns = `repeat(${widthTiles}, ${tileSize}px)`
    container.style.gridTemplateRows = `repeat(${heightTiles}, ${tileSize}px)`
    container.style.gap = '0px' // No gap between tiles for seamless map
    container.style.padding = '20px'
    container.style.overflow = 'auto'
    container.style.width = '100%'
    container.style.height = '100%'
    container.style.boxSizing = 'border-box'

    // Create placeholder tiles for the entire map area
    for (let chunkY = minY; chunkY <= maxY; chunkY++) {
      for (let chunkX = minX; chunkX <= maxX; chunkX++) {
        for (let localY = 0; localY < chunkSize; localY++) {
          for (let localX = 0; localX < chunkSize; localX++) {
            const worldX = chunkX * chunkSize + localX
            const worldY = chunkY * chunkSize + localY
            const tileKey = `tile-${worldX}-${worldY}`
            
            const imgElement = document.createElement('img')
            imgElement.style.width = `${tileSize}px`
            imgElement.style.height = `${tileSize}px`
            imgElement.style.imageRendering = 'pixelated'
            imgElement.style.imageRendering = 'crisp-edges'
            imgElement.style.cursor = 'pointer'
            imgElement.style.backgroundColor = '#e5e7eb' // Placeholder gray
            imgElement.style.display = 'block'
            
            // Add loading attribute for better performance
            imgElement.loading = 'lazy'
            imgElement.alt = `Tile ${worldX},${worldY}`
            
            // Store tile data for event handling
            imgElement.dataset.chunkX = chunkX.toString()
            imgElement.dataset.chunkY = chunkY.toString()
            imgElement.dataset.localX = localX.toString()
            imgElement.dataset.localY = localY.toString()
            imgElement.dataset.worldX = worldX.toString()
            imgElement.dataset.worldY = worldY.toString()
            
            // Add click event listener for tooltip
            imgElement.addEventListener('click', (event: MouseEvent) => {
              const chunkDataKey = `${chunkX},${chunkY}`
              const chunkData = chunks.get(chunkDataKey)
              if (chunkData) {
                const tileIndex = localY * chunkSize + localX
                const tileData = chunkData[tileIndex]
                if (tileData) {
                  setTooltip({
                    visible: true,
                    x: event.clientX,
                    y: event.clientY,
                    tileData: {
                      biome: tileData.biome,
                      elevation: tileData.elevation,
                      worldX: worldX,
                      worldY: worldY,
                      chunkX: chunkX,
                      chunkY: chunkY,
                      localX: localX,
                      localY: localY
                    }
                  })
                }
              }
            })
            
            container.appendChild(imgElement)
            tileElementsRef.current.set(tileKey, imgElement)
          }
        }
      }
    }
  }, [bounds, chunkSize, tileSize, basePNGsLoaded, chunks])

  // Create grid when bounds are available
  useEffect(() => {
    if (bounds && containerRef.current && basePNGsLoaded) {
      createCSSGradientGrid()
    }
  }, [createCSSGradientGrid])

  // Update tile images when chunks change
  useEffect(() => {
    if (!bounds || chunks.size === 0 || !basePNGsLoaded) return

    chunks.forEach((chunkData, chunkKey) => {
      const [chunkX, chunkY] = chunkKey.split(',').map(Number)
      
      // Update all tiles in this chunk
      for (let localY = 0; localY < chunkSize; localY++) {
        for (let localX = 0; localX < chunkSize; localX++) {
          const worldX = chunkX * chunkSize + localX
          const worldY = chunkY * chunkSize + localY
          const tileKey = `tile-${worldX}-${worldY}`
          const tileElement = tileElementsRef.current.get(tileKey)
          
          if (tileElement) {
            const tileIndex = localY * chunkSize + localX
            const tileData = chunkData[tileIndex]
            
            if (tileData) {
              // Get base biome PNG URL
              const baseBiomePNGUrl = getBaseBiomePNGUrl(tileData.biome)
              
              // Apply elevation CSS effect
              const elevationCSS = createElevationCSS(tileData.elevation)
              
              // Update tile with base biome PNG and CSS elevation effect
              requestAnimationFrame(() => {
                tileElement.src = baseBiomePNGUrl
                tileElement.style.cssText += elevationCSS
                tileElement.style.backgroundColor = 'transparent'
              })
            }
          }
        }
      }
    })
  }, [chunks, bounds, chunkSize, tileSize, basePNGsLoaded])

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
      tileElementsRef.current.clear()
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
          className="dom-world-map css-gradient-grid"
        />
      ) : (
        <div className="map-placeholder">
          {isGenerating ? 
            '🌍 Generating chunks...' : 
            '🗺️ Click "Start Generation" to create a world'
          }
          {!basePNGsLoaded && <div>🎨 Loading base biome images...</div>}
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

CSSGradientWorldMap.displayName = 'CSSGradientWorldMap'

export default CSSGradientWorldMap