import React, { useState, useRef, useCallback } from 'react'
import ControlPanel from './ControlPanel'
import DomWorldMap from './DomWorldMap'

interface ChunkCoordinate {
  x: number
  y: number
}

interface ChunkData {
  [key: number]: {
    biome: string
    elevation: number
  }
}

interface WorldMapRef {
  setMapSize: (minX: number, maxX: number, minY: number, maxY: number) => void
  addChunk: (chunkX: number, chunkY: number, chunkData: ChunkData, minX: number, minY: number) => void
  clear: () => void
}

/**
 * Main world generator component that orchestrates chunk generation and rendering
 */
const WorldGenerator: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [minX, setMinX] = useState(0)
  const [maxX, setMaxX] = useState(100)
  const [minY, setMinY] = useState(0)
  const [maxY, setMaxY] = useState(100)
  const [worldName, setWorldName] = useState('')
  const [loadedChunks, setLoadedChunks] = useState(0)
  const [totalChunks, setTotalChunks] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [chunks, setChunks] = useState(new Map<string, ChunkData>())

  const worldMapRef = useRef<WorldMapRef>(null)

  // Private generation state
  const activeRequestsRef = useRef(0)
  const maxParallelRequests = 5
  const loadingQueueRef = useRef<ChunkCoordinate[]>([])
  const seedRef = useRef('')
  const batchSize = 200
  const canvasSizeSetRef = useRef(false)

  const getWorldMap = useCallback(() => {
    return worldMapRef.current
  }, [])

  const handleCoordinateChange = useCallback((changes: { [key: string]: number }) => {
    Object.keys(changes).forEach(key => {
      const value = changes[key]
      switch (key) {
        case 'minX':
          setMinX(value)
          break
        case 'maxX':
          setMaxX(value)
          break
        case 'minY':
          setMinY(value)
          break
        case 'maxY':
          setMaxY(value)
          break
      }
    })
  }, [])

  const handleWorldNameChange = useCallback((name: string) => {
    setWorldName(name)
  }, [])

  const generateRandomSeed = (): string => {
    return `${Date.now()}-${Math.floor(Math.random() * 10000)}`
  }

  const generateDiagonalQueue = useCallback((): ChunkCoordinate[] => {
    const queue: ChunkCoordinate[] = []
    const widthChunks = maxX - minX + 1
    const heightChunks = maxY - minY + 1
    const maxDiagonal = widthChunks + heightChunks - 2

    for (let d = 0; d <= maxDiagonal; d++) {
      for (let x = 0; x < widthChunks; x++) {
        const y = d - x
        if (y >= 0 && y < heightChunks) {
          queue.push({
            x: minX + x,
            y: minY + y
          })
        }
      }
    }

    return queue
  }, [minX, maxX, minY, maxY])

  const getBiomeFromCompactTile = (tile: any): string => {
    // Map biome indices to biome names based on BIOME_TYPES from shared/types.ts
    const biomes = [
      'deep_ocean', 'shallow_ocean', 'desert', 'tundra', 'arctic', 'swamp',
      'grassland', 'forest', 'taiga', 'savanna', 'tropical_forest', 'alpine'
    ]
    return biomes[tile.b] || 'grassland'
  }

  const loadChunkBatch = async (batchChunks: ChunkCoordinate[]) => {
    activeRequestsRef.current++

    try {
      const response = await fetch('/api/chunks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chunks: batchChunks.map(c => ({ chunkX: c.x, chunkY: c.y })),
          seed: seedRef.current
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const batchData = await response.json()
      
      // Process each chunk in the batch
      for (const chunkResponse of batchData.chunks) {
        const { chunkX, chunkY, tiles } = chunkResponse
        
        // Convert response format to the expected ChunkData format
        const chunkData: ChunkData = {}
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const tileIndex = y * 16 + x
            const tile = tiles[y][x]
            
            // Convert compact tile format to expected format
            chunkData[tileIndex] = {
              biome: getBiomeFromCompactTile(tile),
              elevation: tile.e / 255
            }
          }
        }
        
        // Add chunk to map and render with fade animation
        setChunks(prevChunks => {
          const newChunks = new Map(prevChunks)
          newChunks.set(`${chunkX},${chunkY}`, chunkData)
          return newChunks
        })
        
        const worldMap = getWorldMap()
        worldMap?.addChunk(chunkX, chunkY, chunkData, minX, minY)
      }
      
      // Update loaded chunks count after processing all chunks in batch
      setLoadedChunks(prev => {
        const newCount = prev + batchData.chunks.length
        // Update status message with the new count
        setStatusMessage(`Loaded ${newCount}/${totalChunks} chunks (batch of ${batchData.chunks.length})`)
        return newCount
      })

    } catch (error) {
      console.error(`Failed to load chunk batch:`, error)
      setStatusMessage(`Error loading chunk batch: ${(error as Error).message}`)
    } finally {
      activeRequestsRef.current--
      
      // Continue processing queue if not paused
      if (!isPaused) {
        processQueue()
      }
    }
  }

  const processQueue = useCallback(async () => {
    while (!isPaused && 
           loadingQueueRef.current.length > 0 && 
           activeRequestsRef.current < maxParallelRequests) {
      
      // Create batch of chunks to load (up to batchSize)
      const batchChunks = loadingQueueRef.current.splice(0, batchSize)
      if (batchChunks.length > 0) {
        loadChunkBatch(batchChunks)
      }
    }

    // Check if generation is complete
    if (loadingQueueRef.current.length === 0 && activeRequestsRef.current === 0) {
      setIsGenerating(false)
      setLoadedChunks(currentCount => {
        setStatusMessage(`Generation complete! Loaded ${currentCount} chunks.`)
        return currentCount
      })
    }
  }, [isPaused])

  const handleStartGeneration = async () => {
    if (isGenerating && isPaused) {
      // Resume generation
      setIsPaused(false)
      setStatusMessage('Resuming generation...')
      processQueue()
      return
    }

    // Start new generation
    setIsGenerating(true)
    setIsPaused(false)
    setLoadedChunks(0)
    setChunks(new Map())
    canvasSizeSetRef.current = false
    
    // Generate or use provided seed
    seedRef.current = worldName || generateRandomSeed()
    
    // Calculate total chunks and set up queue
    const totalChunkCount = (maxX - minX + 1) * (maxY - minY + 1)
    setTotalChunks(totalChunkCount)
    setStatusMessage(`Starting generation of ${totalChunkCount} chunks...`)
    
    // Set canvas size upfront since we know the bounds
    const worldMap = getWorldMap()
    worldMap?.setMapSize(minX, maxX, minY, maxY)
    
    // Generate diagonal loading queue
    loadingQueueRef.current = generateDiagonalQueue()
    activeRequestsRef.current = 0
    
    // Start processing
    processQueue()
  }

  const handlePauseGeneration = () => {
    if (isGenerating) {
      setIsPaused(!isPaused)
      setStatusMessage(isPaused ? 'Generation paused' : 'Resuming generation...')
      
      if (isPaused) {
        processQueue()
      }
    }
  }

  return (
    <>
      <ControlPanel
        minX={minX}
        maxX={maxX}
        minY={minY}
        maxY={maxY}
        worldName={worldName}
        isGenerating={isGenerating}
        isPaused={isPaused}
        statusMessage={statusMessage}
        onCoordinateChange={handleCoordinateChange}
        onWorldNameChange={handleWorldNameChange}
        onStartGeneration={handleStartGeneration}
        onPauseGeneration={handlePauseGeneration}
      />
      
      <DomWorldMap
        ref={worldMapRef}
        chunks={chunks}
        isGenerating={isGenerating}
      />
    </>
  )
}

export default WorldGenerator