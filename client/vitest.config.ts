import { defineConfig } from 'vitest/config';

// Client unit tests (ROADMAP 7.2). Pure logic only — no browser needed. Run: `npm test`
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.{ts,tsx}'],
    reporters: 'default',
  },
});
