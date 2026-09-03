import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Each suite points DB_PATH at its own temp SQLite file and imports the app
    // once; separate files must not share a process or those envs collide.
    fileParallelism: false,
  },
});
