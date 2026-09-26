/**
 * Runs MongoDB locally for development without installing it: a single-node replica
 * set (the server needs transactions) on 127.0.0.1:27017, replica set `rs0` — which
 * is the server's default MONGODB_URI. Data persists in ./data/mongo between runs.
 *
 * Usage: npm run db:dev   (leave it running; Ctrl+C to stop)
 *
 * The first run downloads a MongoDB binary into the mongodb-memory-server cache.
 * For anything shared or long-lived use a real MongoDB (Atlas, or `mongod --replSet`).
 */
import fs from 'fs';
import path from 'path';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const PORT = Number(process.env.MONGO_DEV_PORT || 27017);
const DATA_DIR = path.resolve(process.env.MONGO_DEV_DATA_DIR || './data/mongo');

async function start(): Promise<void> {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const replSet = await MongoMemoryReplSet.create({
    replSet: { name: 'rs0', count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: [{ port: PORT, dbPath: DATA_DIR }],
  });

  process.stdout.write(`MongoDB replica set running: ${replSet.getUri()}\nData: ${DATA_DIR}\n`);

  const stop = async (): Promise<void> => {
    await replSet.stop({ doCleanup: false });
    process.exit(0);
  };

  process.once('SIGINT', () => void stop());
  process.once('SIGTERM', () => void stop());
}

start().catch((err: unknown) => {
  process.stderr.write(`Could not start MongoDB: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
