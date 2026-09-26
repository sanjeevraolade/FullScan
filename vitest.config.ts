import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // One in-memory MongoDB replica set for the run; each suite gets its own database on it.
    globalSetup: ['tests/helpers/mongo-global-setup.ts'],
    // Each suite sets MONGODB_DB / UPLOAD_DIR env and imports the app once; separate
    // files must not share a process or those envs collide.
    fileParallelism: false,
  },
});
