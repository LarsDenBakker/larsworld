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
app.use(express.json());

// Serve static files from the 'web' directory for local dev
app.use(express.static(path.join(__dirname, '../../web')));

// Mount the API router
app.use('/api', router);

app.listen(port, () => {
  console.log(`Local server listening at http://localhost:${port}`);
});