import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { authenticate } from './middleware/authenticate.js';
import { authenticateAdmin } from './middleware/authenticate-admin.js';
import { authRoutes } from './routes/auth.routes.js';
import { uiConfigRoutes } from './routes/ui-config.routes.js';
import { referenceDataRoutes } from './routes/reference-data.routes.js';
import { caseRoutes } from './routes/case.routes.js';
import { meRoutes } from './routes/field-executive.routes.js';
import { securityRoutes } from './routes/security.routes.js';
import { adminAuthRoutes } from './routes/admin-auth.routes.js';
import { mobileAppSettingRoutes } from './routes/mobile-app-setting.routes.js';
import { adminCaseRoutes } from './routes/admin-case.routes.js';
import { adminFieldExecutiveRoutes } from './routes/admin-field-executive.routes.js';
import { adminPortalRoutes } from './routes/admin-portal.routes.js';

export const app = express();

// Security & parsing
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));

// Mobile app routes (field-executive session)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/ui-config', uiConfigRoutes);
app.use('/api/v1/reference-data', referenceDataRoutes);
app.use('/api/v1/cases', authenticate, caseRoutes);
app.use('/api/v1/me', authenticate, meRoutes);
app.use('/api/v1/security', authenticate, securityRoutes);

// Admin API (admin-scoped session) — everything but /auth requires a signed-in admin
app.use('/api/v1/admin/auth', adminAuthRoutes);
app.use('/api/v1/admin/mobile-app-settings', authenticateAdmin, mobileAppSettingRoutes);
app.use('/api/v1/admin/cases', authenticateAdmin, adminCaseRoutes);
app.use('/api/v1/admin/field-executives', authenticateAdmin, adminFieldExecutiveRoutes);

// Admin Portal — server-rendered static front end at /admin (pages guarded server-side)
app.use('/admin', adminPortalRoutes);

// Error handler (must be last)
app.use(errorHandler);
