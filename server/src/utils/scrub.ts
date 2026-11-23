/**
 * PII scrubbing for crash reports (ROADMAP 7.2). Crash reports must never contain what people told Aastha:
 * no request bodies (chat/diary text), no cookies/tokens, no emails/phone numbers, no query strings.
 * Pure + dependency-free so it is unit-tested (tests/integration/phase7.test.ts) and shared by server + client copy.
 */
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+?\d[\d\s-]{8,}\d)/g;
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const BEARER = /Bearer\s+[A-Za-z0-9._-]+/gi;
const LONG_SECRET = /\b[A-Za-z0-9_-]{32,}\b/g;
const DATA_URL = /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi;

export const scrubText = (s: unknown): string => {
  if (typeof s !== 'string') return '';
  return s
    .replace(DATA_URL, '[data-url]')
    .replace(JWT, '[token]')
    .replace(BEARER, 'Bearer [token]')
    .replace(EMAIL, '[email]')
    .replace(PHONE, '[number]')
    .replace(LONG_SECRET, '[secret]')
    .slice(0, 2000);
};

const SAFE_HEADERS = new Set(['user-agent', 'content-type', 'content-length', 'accept', 'x-request-id']);

/** Works on Sentry event objects (server and browser shapes). Returns null to drop the event. */
export const scrubEvent = <T extends Record<string, any>>(event: T): T => {
  const e: any = event;
  if (e.request) {
    delete e.request.data;
    delete e.request.cookies;
    delete e.request.query_string;
    if (e.request.url) e.request.url = String(e.request.url).split('?')[0];
    if (e.request.headers) {
      for (const k of Object.keys(e.request.headers)) if (!SAFE_HEADERS.has(k.toLowerCase())) delete e.request.headers[k];
    }
  }
  if (e.user) e.user = e.user.id ? { id: String(e.user.id) } : undefined;
  delete e.extra;
  if (e.contexts) { delete e.contexts.state; delete e.contexts.response; }
  if (typeof e.message === 'string') e.message = scrubText(e.message);
  for (const ex of e.exception?.values || []) {
    if (typeof ex.value === 'string') ex.value = scrubText(ex.value);
    for (const fr of ex.stacktrace?.frames || []) { delete fr.vars; }
  }
  if (Array.isArray(e.breadcrumbs)) e.breadcrumbs = e.breadcrumbs.map(scrubBreadcrumb).filter(Boolean);
  return event;
};

/** Console logs can contain message text → dropped; http/navigation crumbs keep only method/status/path. */
export const scrubBreadcrumb = (b: any): any => {
  if (!b) return null;
  if (b.category === 'console' || b.category === 'ui.input') return null;
  const out: any = { ...b };
  if (out.message) out.message = scrubText(out.message);
  if (out.data) {
    const d: any = {};
    if (out.data.method) d.method = out.data.method;
    if (out.data.status_code) d.status_code = out.data.status_code;
    if (out.data.url) d.url = String(out.data.url).split('?')[0];
    if (out.data.from) d.from = String(out.data.from).split('?')[0];
    if (out.data.to) d.to = String(out.data.to).split('?')[0];
    out.data = d;
  }
  return out;
};
