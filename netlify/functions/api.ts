import express from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import router from '../../src/server/router.js';

const app = express();

app.use(cors());

// Configure JSON parsing with increased size limit for large payloads
// Set to 20MB to handle large map generation requests and uploads
app.use(express.json({ limit: '20mb' }));

// Add request logging middleware for debugging payload issues
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

app.use('/api', router);

export const handler = serverless(app);