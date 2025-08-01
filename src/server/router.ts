import { Router } from 'express';
import { generateMapChunk, validateMapChunkRequest } from '../map-generator/index.js';
import { MapChunkRequest, MapBatchChunkRequest, MapBatchChunkResponse, ApiError } from '../shared/types.js';

const router = Router();

// Existing ping endpoint
router.get('/ping', (req, res) => {
  res.json({ message: 'Hello World from the local server!' });
});

// Test endpoint for payload size limits
router.post('/test-payload', (req, res) => {
  try {
    const payloadSize = JSON.stringify(req.body).length;
    console.log(`[Test Payload] Received POST with ${payloadSize} bytes`);
    
    res.json({ 
      message: 'Payload received successfully',
      size: payloadSize,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Test Payload] Error processing payload: ${errorMessage}`);
    res.status(400).json({ 
      error: 'Failed to process payload',
      details: errorMessage 
    });
  }
});


// Chunk-based map generation endpoint - new primary method
router.get('/chunk', (req, res) => {
  try {
    // Parse query parameters - chunkX, chunkY, and seed
    const chunkX = parseInt(req.query.chunkX as string);
    const chunkY = parseInt(req.query.chunkY as string);
    const seed = req.query.seed as string || 'default';

    // Validate numeric inputs
    if (isNaN(chunkX) || isNaN(chunkY)) {
      const error: ApiError = {
        error: 'Invalid chunk coordinates',
        details: 'chunkX and chunkY must be valid integers'
      };
      return res.status(400).json(error);
    }

    const request: MapChunkRequest = {
      chunkX,
      chunkY,
      seed
    };

    console.log(`[Chunk Map] Request: chunkX=${chunkX}, chunkY=${chunkY}, seed=${seed} (16x16 chunk)`);

    // Validate request
    validateMapChunkRequest(request);

    // Generate the requested chunk
    const startTime = Date.now();
    const response = generateMapChunk(request);
    const duration = Date.now() - startTime;

    console.log(`[Chunk Map] Generated chunk (${chunkX}, ${chunkY}) in ${duration}ms, size: ${Math.round(response.sizeBytes / 1024)}KB`);

    // Check if payload exceeds 6MB limit (shouldn't happen for single chunks)
    if (response.sizeBytes > 6 * 1024 * 1024) {
      const error: ApiError = {
        error: 'Payload too large',
        details: `Generated ${Math.round(response.sizeBytes / 1024 / 1024 * 100) / 100}MB, exceeds 6MB limit`
      };
      return res.status(413).json(error);
    }

    res.json(response);

  } catch (error) {
    console.error('[Chunk Map] Error:', error);
    const apiError: ApiError = {
      error: 'Chunk generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(400).json(apiError);
  }
});

// POST version of chunk endpoint for frontend compatibility
router.post('/chunk', (req, res) => {
  try {
    // Parse POST body - chunkX, chunkY, and seed
    const { chunkX, chunkY, seed = 'default' } = req.body;

    // Validate numeric inputs
    if (typeof chunkX !== 'number' || typeof chunkY !== 'number') {
      const error: ApiError = {
        error: 'Invalid chunk coordinates',
        details: 'chunkX and chunkY must be valid numbers'
      };
      return res.status(400).json(error);
    }

    const request: MapChunkRequest = {
      chunkX,
      chunkY,
      seed
    };

    console.log(`[Chunk Map POST] Request: chunkX=${chunkX}, chunkY=${chunkY}, seed=${seed} (16x16 chunk)`);

    // Validate request
    validateMapChunkRequest(request);

    // Generate the requested chunk
    const startTime = Date.now();
    const response = generateMapChunk(request);
    const duration = Date.now() - startTime;

    console.log(`[Chunk Map POST] Generated chunk (${chunkX}, ${chunkY}) in ${duration}ms, size: ${Math.round(response.sizeBytes / 1024)}KB`);

    // Check if payload exceeds 6MB limit (shouldn't happen for single chunks)
    if (response.sizeBytes > 6 * 1024 * 1024) {
      const error: ApiError = {
        error: 'Payload too large',
        details: `Generated ${Math.round(response.sizeBytes / 1024 / 1024 * 100) / 100}MB, exceeds 6MB limit`
      };
      return res.status(413).json(error);
    }

    res.json(response);

  } catch (error) {
    console.error('[Chunk Map POST] Error:', error);
    const apiError: ApiError = {
      error: 'Chunk generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(400).json(apiError);
  }
});

// Batch chunk endpoint for efficient chunk fetching
router.post('/chunks', (req, res) => {
  try {
    const { chunks, seed = 'default' } = req.body as MapBatchChunkRequest;

    // Validate input
    if (!Array.isArray(chunks) || chunks.length === 0) {
      const error: ApiError = {
        error: 'Invalid chunks array',
        details: 'chunks must be a non-empty array of {chunkX, chunkY} objects'
      };
      return res.status(400).json(error);
    }

    // Validate each chunk coordinate
    for (const chunk of chunks) {
      if (typeof chunk.chunkX !== 'number' || typeof chunk.chunkY !== 'number') {
        const error: ApiError = {
          error: 'Invalid chunk coordinates',
          details: 'All chunks must have valid chunkX and chunkY numbers'
        };
        return res.status(400).json(error);
      }
    }

    console.log(`[Batch Chunks] Request: ${chunks.length} chunks, seed=${seed}`);

    const startTime = Date.now();
    let totalSizeBytes = 0;
    const generatedChunks = [];

    // Generate each chunk
    for (const { chunkX, chunkY } of chunks) {
      const request: MapChunkRequest = { chunkX, chunkY, seed };
      
      try {
        validateMapChunkRequest(request);
        const chunkResponse = generateMapChunk(request);
        generatedChunks.push(chunkResponse);
        totalSizeBytes += chunkResponse.sizeBytes;

        // Check if we're approaching the 6MB limit
        if (totalSizeBytes > 6 * 1024 * 1024) {
          console.warn(`[Batch Chunks] Payload size ${Math.round(totalSizeBytes / 1024 / 1024 * 100) / 100}MB exceeds 6MB limit`);
          break;
        }
      } catch (chunkError) {
        console.error(`[Batch Chunks] Failed to generate chunk (${chunkX}, ${chunkY}):`, chunkError);
        // Continue with other chunks rather than failing the entire batch
      }
    }

    const duration = Date.now() - startTime;

    if (totalSizeBytes > 6 * 1024 * 1024) {
      const error: ApiError = {
        error: 'Batch payload too large',
        details: `Generated ${Math.round(totalSizeBytes / 1024 / 1024 * 100) / 100}MB, exceeds 6MB limit. Consider requesting fewer chunks.`
      };
      return res.status(413).json(error);
    }

    const response: MapBatchChunkResponse = {
      chunks: generatedChunks,
      totalSizeBytes,
      seed
    };

    console.log(`[Batch Chunks] Generated ${generatedChunks.length} chunks in ${duration}ms, total size: ${Math.round(totalSizeBytes / 1024)}KB`);

    res.json(response);

  } catch (error) {
    console.error('[Batch Chunks] Error:', error);
    const apiError: ApiError = {
      error: 'Batch chunk generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(400).json(apiError);
  }
});



export default router;