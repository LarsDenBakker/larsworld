// This file is for local development only.
// It runs the same server logic as the Netlify function.
import express, { Router } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Re-create the same router logic as in the serverless function
const router = Router();
router.get('/ping', (req, res) => {
  res.json({ message: 'Hello World from the local server!' });
});

app.use(cors());
app.use(express.json());

// Serve static files from the 'web' directory for local dev
app.use(express.static(path.join(__dirname, '../../web')));

// Mount the API router
app.use('/api', router);

app.listen(port, () => {
  console.log(`Local server listening at http://localhost:${port}`);
});