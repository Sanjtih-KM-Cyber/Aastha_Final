import { defineConfig } from 'vitest/config';

// Tests that format clock times (e.g. "Refills at 3:40 pm") assume one fixed time zone. Pin it so results are the
// same on a laptop in India and on GitHub's UTC runners. Set before the test workers start (they inherit it).
process.env.TZ = 'Asia/Kolkata';

// Client unit tests (ROADMAP 7.2). Pure logic only — no browser needed. Run: `npm test`
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.{ts,tsx}'],
    reporters: 'default',
    env: { TZ: 'Asia/Kolkata' },
  },
});
