import express, { Router } from 'express';
import serverless from 'serverless-http';
import cors from 'cors';

const app = express();
const router = Router();

app.use(cors());
app.use(express.json());

router.get('/ping', (req, res) => {
  res.json({ message: 'Hello World from the serverless function!' });
});

app.use('/api', router);

export const handler = serverless(app);