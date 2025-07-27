import { Router } from 'express';
import { generateMap } from '../map-generator/index.js';

const router = Router();

// Existing ping endpoint
router.get('/ping', (req, res) => {
  res.json({ message: 'Hello World from the local server!' });
});

// New map generation endpoint - always generates 1000x1000 earthlike world
router.post('/generate-map', (req, res) => {
  try {
    // Fixed dimensions for earthlike planet simulation
    const width = 1000;
    const height = 1000;
    
    const map = generateMap(width, height);
    res.json({ 
      map,
      width,
      height,
      generated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating map:', error);
    res.status(500).json({ 
      error: 'Failed to generate map' 
    });
  }
});

export default router;