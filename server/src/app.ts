import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { uiConfigRoutes } from './routes/ui-config.routes.js';

export const app = express();

// Security & parsing
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));

// Routes
app.use('/api/v1/ui-config', uiConfigRoutes);

// Error handler (must be last)
app.use(errorHandler);
