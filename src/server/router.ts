import { Router } from 'express';
import { generateMapChunk, validateMapChunkRequest } from '../map-generator/index.js';
import { MapChunkRequest, ApiError } from '../shared/types.js';

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



export default router;