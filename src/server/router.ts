import { Router } from 'express';
import { generateMap } from '../map-generator/index.js';

const router = Router();

// Existing ping endpoint
router.get('/ping', (req, res) => {
  res.json({ message: 'Hello World from the local server!' });
});

// New map generation endpoint
router.post('/generate-map', (req, res) => {
  try {
    const { width = 20, height = 15 } = req.body;
    
    // Validate input parameters
    if (typeof width !== 'number' || typeof height !== 'number') {
      return res.status(400).json({ 
        error: 'Width and height must be numbers' 
      });
    }
    
    if (width < 1 || width > 100 || height < 1 || height > 100) {
      return res.status(400).json({ 
        error: 'Width and height must be between 1 and 100' 
      });
    }
    
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