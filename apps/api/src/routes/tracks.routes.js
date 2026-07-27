import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import * as tracksController from '../controllers/tracks.controller.js';

export const tracksRouter = Router();

tracksRouter.get('/', requireAuth, tracksController.getTracks);
