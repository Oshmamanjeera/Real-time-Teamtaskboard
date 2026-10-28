import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false, // Run test suites sequentially to prevent DB migration locks
    environment: 'node',
  },
});

