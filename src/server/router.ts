import { Router } from 'express';
import { generateMapPage, validateMapPageRequest } from '../map-generator/index.js';
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

// Simple test endpoint for small map generation
router.get('/test-map', async (req, res) => {
  try {
    // Import generateMap for testing
    const { generateMap } = await import('../map-generator/index.js');
    
    // Generate a small test map
    const width = parseInt(req.query.width as string) || 50;
    const height = parseInt(req.query.height as string) || 50;
    
    // Limit to reasonable test sizes
    if (width > 100 || height > 100) {
      return res.status(400).json({ error: 'Test maps limited to 100x100 for performance' });
    }
    
    console.log(`[Test Map] Generating ${width}x${height} test map...`);
    const startTime = Date.now();
    
    const map = generateMap(width, height);
    
    const duration = Date.now() - startTime;
    
    // Count biomes
    const biomeCounts: Record<string, number> = {};
    let edgeOceanCount = 0;
    let totalEdges = 0;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const biome = map[y][x].type;
        biomeCounts[biome] = (biomeCounts[biome] || 0) + 1;
        
        // Check if this is an edge tile
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          totalEdges++;
          if (biome === 'ocean') {
            edgeOceanCount++;
          }
        }
      }
    }
    
    console.log(`[Test Map] Generated in ${duration}ms, ${edgeOceanCount}/${totalEdges} edges are ocean`);
    
    res.json({
      width,
      height,
      generationTime: duration,
      biomeCounts,
      edgeOceanRatio: edgeOceanCount / totalEdges,
      allEdgesOcean: edgeOceanCount === totalEdges
    });
    
  } catch (error) {
    console.error('[Test Map] Error:', error);
    res.status(500).json({ 
      error: 'Test map generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Paginated map generation endpoint
router.get('/map', (req, res) => {
  try {
    // Parse query parameters - only page, pageSize, and seed matter
    const page = parseInt(req.query.page as string) || 0;
    const pageSize = parseInt(req.query.pageSize as string) || 64;
    const seed = req.query.seed as string || 'default';

    const request: MapPageRequest = {
      page,
      pageSize,
      seed
    };

    console.log(`[Paginated Map] Request: page=${page}, pageSize=${pageSize}, seed=${seed} (fixed 1000x1000)`);

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

export default router;