import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { notFoundHandler, errorHandler } from './middleware/error.middleware.js';
import { authRouter } from './routes/auth.routes.js';
import { scoresRouter } from './routes/scores.routes.js';

export const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/api/v1/scores', scoresRouter);

app.use(notFoundHandler);
app.use(errorHandler);
