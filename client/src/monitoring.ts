/**
 * Client crash reporting (ROADMAP 7.2). OFF unless VITE_SENTRY_DSN is set at build time (Vercel env / CI).
 * Errors only — no performance tracing, no session replay, no default PII. Every event passes utils/scrub.ts:
 * no request bodies, cookies, tokens, emails, phone numbers, console logs or typed input.
 * The SDK is loaded lazily so it costs nothing when the DSN isn't configured.
 */
import { scrubEvent, scrubBreadcrumb } from './utils/scrub';

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
let sentry: typeof import('@sentry/react') | null = null;

export const initMonitoring = async () => {
  if (!DSN || sentry) return;
  try {
    const S = await import('@sentry/react');
    S.init({
      dsn: DSN,
      environment: import.meta.env.MODE,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      maxBreadcrumbs: 30,
      integrations: (defaults) => defaults.filter((i) => !['Replay', 'BrowserTracing'].includes(i.name)),
      beforeSend: (event) => scrubEvent(event as any) as any,
      beforeBreadcrumb: (b) => scrubBreadcrumb(b),
    });
    sentry = S;
  } catch (e) {
    console.warn('[Monitoring] Sentry failed to load', e);
  }
};

export const reportError = (err: unknown, tags?: Record<string, string>) => {
  if (!sentry) return;
  try { sentry.captureException(err, tags ? { tags } : undefined); } catch { /* ignore */ }
};
