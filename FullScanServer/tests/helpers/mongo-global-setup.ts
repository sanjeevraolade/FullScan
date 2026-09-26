import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { GlobalSetupContext } from 'vitest/node';

/**
 * Starts one throwaway single-node MongoDB replica set for the whole test run (a
 * replica set, because the server uses transactions). Each suite then works in its
 * own database on it — see `test-app.ts`.
 *
 * The first run downloads a MongoDB binary into the mongodb-memory-server cache.
 */
export default async function setup({ provide }: GlobalSetupContext): Promise<() => Promise<void>> {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });

  provide('mongoUri', replSet.getUri());

  return async () => {
    await replSet.stop();
  };
}
