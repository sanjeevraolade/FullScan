import dotenv from 'dotenv';
import { app } from './app.js';
import { logger } from './utils/logger.js';
import { initDb } from './db/connection.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

initDb();

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
