import dotenv from 'dotenv';
import { app } from './app.js';
import { logger } from './utils/logger.js';
import { closeDb, initDb } from './db/connection.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

async function start(): Promise<void> {
  await initDb();

  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });

  const shutdown = (signal: string): void => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => {
      void closeDb().finally(() => process.exit(0));
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err: unknown) => {
  logger.fatal(err, 'Server failed to start');
  process.exit(1);
});
