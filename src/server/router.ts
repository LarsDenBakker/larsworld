import { Router } from 'express';
import { generateMapChunked } from '../map-generator/index.js';

const router = Router();

// Existing ping endpoint
router.get('/ping', (req, res) => {
  res.json({ message: 'Hello World from the local server!' });
});

// New map generation endpoint - streams 1000x1000 earthlike world in chunks
router.get('/generate-map', (req, res) => {
  try {
    // Fixed dimensions for earthlike planet simulation
    const width = 1000;
    const height = 1000;
    
    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial metadata
    res.write(`data: ${JSON.stringify({
      type: 'start',
      width,
      height,
      totalChunks: Math.ceil(height / 50) // 50 rows per chunk
    })}\n\n`);

    // Generate and stream map in chunks
    generateMapChunked(width, height, (chunk) => {
      res.write(`data: ${JSON.stringify({
        type: 'chunk',
        ...chunk
      })}\n\n`);
    }, () => {
      // Generation complete
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        generated: new Date().toISOString()
      })}\n\n`);
      res.end();
    }, (error) => {
      // Error occurred
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message
      })}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('Error starting map generation:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Failed to start map generation' 
    }));
  }
});

export default router;