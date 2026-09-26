/**
 * `npm run migrate` — applies the schema and any pending migrations, then exits.
 * The server does the same on every start; this is for doing it ahead of a deploy.
 */
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { closeDb, initDb } from './connection.js';

dotenv.config();

initDb()
  .then(closeDb)
  .catch(async (err: unknown) => {
    logger.fatal(err, 'Migration failed');
    await closeDb();
    process.exit(1);
  });
