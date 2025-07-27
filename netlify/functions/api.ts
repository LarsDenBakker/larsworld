import express from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import router from '../../src/server/router.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', router);

export const handler = serverless(app);