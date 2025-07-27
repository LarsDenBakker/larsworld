// This file is for local development only.
// It runs the same server logic as the Netlify function.
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import router from './router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(cors());

// Configure JSON parsing with increased size limit for large payloads
// Set to 20MB to match the Netlify function configuration
app.use(express.json({ limit: '20mb' }));

// Add request logging middleware for debugging payload issues (local development)
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  // Log request details
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log(`Content-Length: ${req.get('content-length') || 'unknown'}`);
  console.log(`Content-Type: ${req.get('content-type') || 'unknown'}`);
  
  // Override res.send to log response details
  res.send = function(data) {
    const duration = Date.now() - start;
    const responseSize = Buffer.isBuffer(data) ? data.length : 
                        typeof data === 'string' ? Buffer.byteLength(data, 'utf8') : 
                        JSON.stringify(data).length;
    
    console.log(`Response: ${res.statusCode} (${duration}ms, ${responseSize} bytes)`);
    
    return originalSend.call(this, data);
  };
  
  // Log any errors that occur
  res.on('error', (error) => {
    console.error(`Response error: ${error.message}`);
  });
  
  next();
});

// Serve static files from the 'web' directory for local dev
app.use(express.static(path.join(__dirname, '../../web')));

// Mount the API router
app.use('/api', router);

app.listen(port, () => {
  console.log(`Local server listening at http://localhost:${port}`);
  console.log(`JSON payload limit: 20MB`);
});