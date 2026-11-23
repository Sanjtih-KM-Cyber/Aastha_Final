/**
 * Crash reporting (ROADMAP 7.2). OFF unless SENTRY_DSN is set on Render.
 * Errors only (no performance tracing), no default PII, every event scrubbed by utils/scrub.ts
 * (no request bodies, cookies, tokens, emails, phone numbers, console breadcrumbs).
 * Must be imported right after dotenv in app.ts so it can hook Express.
 */
import * as Sentry from '@sentry/node';
import { scrubEvent, scrubBreadcrumb } from './utils/scrub';

export const sentryEnabled = !!process.env.SENTRY_DSN;

if (sentryEnabled) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    release: process.env.RENDER_GIT_COMMIT || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    maxBreadcrumbs: 30,
    beforeSend: (event) => scrubEvent(event as any) as any,
    beforeBreadcrumb: (b) => scrubBreadcrumb(b),
  });
  console.log('[Monitoring] Sentry crash reporting on (PII scrubbed).');
}

export const captureError = (err: unknown, tags?: Record<string, string>) => {
  if (!sentryEnabled) return;
  try { Sentry.captureException(err, tags ? { tags } : undefined); } catch { /* never let reporting break the API */ }
};

export const flushMonitoring = async (ms = 2000) => {
  if (!sentryEnabled) return;
  try { await Sentry.flush(ms); } catch { /* ignore */ }
};
