import { Router } from 'express';
import { generateMapChunked } from '../map-generator/index.js';
import { generateMapPage, validateMapPageRequest } from '../map-generator/paginated.js';
import { MapPageRequest, ApiError } from '../shared/types.js';

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

// New paginated map generation endpoint
router.get('/map', (req, res) => {
  try {
    // Parse query parameters
    const page = parseInt(req.query.page as string) || 0;
    const pageSize = parseInt(req.query.pageSize as string) || 64;
    const width = parseInt(req.query.width as string) || 256;
    const height = parseInt(req.query.height as string) || 256;
    const seed = req.query.seed as string || 'default';

    const request: MapPageRequest = {
      page,
      pageSize,
      width,
      height,
      seed
    };

    console.log(`[Paginated Map] Request: page=${page}, pageSize=${pageSize}, width=${width}, height=${height}, seed=${seed}`);

    // Validate request
    validateMapPageRequest(request);

    // Generate the requested page
    const startTime = Date.now();
    const response = generateMapPage(request);
    const duration = Date.now() - startTime;

    console.log(`[Paginated Map] Generated page ${page} in ${duration}ms, size: ${Math.round(response.sizeBytes / 1024)}KB`);

    // Check if payload exceeds 6MB limit
    if (response.sizeBytes > 6 * 1024 * 1024) {
      const error: ApiError = {
        error: 'Payload too large',
        details: `Generated ${Math.round(response.sizeBytes / 1024 / 1024 * 100) / 100}MB, exceeds 6MB limit`
      };
      return res.status(413).json(error);
    }

    res.json(response);

  } catch (error) {
    console.error('[Paginated Map] Error:', error);
    const apiError: ApiError = {
      error: 'Map generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(400).json(apiError);
  }
});

// New map generation endpoint - streams 500x500 earthlike world in chunks
router.get('/generate-map', (req, res) => {
  try {
    // Fixed dimensions for earthlike planet simulation
    const width = 500;
    const height = 500;
    
    // Log map generation start with expected payload information
    console.log(`[Map Generation] Starting generation for ${width}x${height} map`);
    console.log(`[Map Generation] Expected total tiles: ${width * height}`);
    console.log(`[Map Generation] Estimated size per chunk: ~${Math.ceil((width * 50 * 150) / 1024)}KB`); // Rough estimate
    
    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial metadata
    const startMetadata = {
      type: 'start',
      width,
      height,
      totalChunks: Math.ceil(height / 50) // 50 rows per chunk
    };
    const startMessage = `data: ${JSON.stringify(startMetadata)}\n\n`;
    console.log(`[Map Generation] Sending start metadata (${Buffer.byteLength(startMessage)} bytes)`);
    res.write(startMessage);

    let chunkCount = 0;
    let totalBytesStreamed = 0;

    // Generate and stream map in chunks
    generateMapChunked(width, height, (chunk) => {
      const chunkMessage = `data: ${JSON.stringify({
        type: 'chunk',
        ...chunk
      })}\n\n`;
      
      const chunkSize = Buffer.byteLength(chunkMessage);
      totalBytesStreamed += chunkSize;
      chunkCount++;
      
      console.log(`[Map Generation] Chunk ${chunkCount}: ${chunkSize} bytes (total: ${Math.round(totalBytesStreamed / 1024)}KB)`);
      res.write(chunkMessage);
    }, () => {
      // Generation complete
      const completeMessage = `data: ${JSON.stringify({
        type: 'complete',
        generated: new Date().toISOString()
      })}\n\n`;
      
      totalBytesStreamed += Buffer.byteLength(completeMessage);
      console.log(`[Map Generation] Complete! Total streamed: ${Math.round(totalBytesStreamed / 1024)}KB in ${chunkCount} chunks`);
      
      res.write(completeMessage);
      res.end();
    }, (error) => {
      // Error occurred
      console.error(`[Map Generation] Error: ${error.message}`);
      const errorMessage = `data: ${JSON.stringify({
        type: 'error',
        error: error.message
      })}\n\n`;
      
      res.write(errorMessage);
      res.end();
    });

  } catch (error) {
    console.error('[Map Generation] Error starting map generation:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Failed to start map generation' 
    }));
  }
});

export default router;