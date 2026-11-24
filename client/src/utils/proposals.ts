/**
 * App-tool tags in Aastha's replies: <proposal tool="jam" params='{"query":"lofi"}' reason="Playing music" />
 * They become chips under the bubble and must NEVER show as text.
 *
 * Old parser bug (2026-11-24): it removed each tag from the string while a /g regex was still walking it, so the
 * regex's index skipped the next tag. A reply with two tags (e.g. stop music + stop sounds) showed the second
 * one as raw text. Now every tag is found on the original text first, then all are removed.
 */
export interface Proposal { tool: string; params: Record<string, unknown>; reason: string }

// Any whole <proposal … />, <proposal …> or <proposal …></proposal> tag, whatever the attribute order/spacing
const TAG = /<proposal\b[^>]*>(?:\s*<\/proposal>)?/gi;
// A tag still arriving while streaming (no closing yet), at the very end
const PARTIAL_TAIL = /<(?:p(?:r(?:o(?:p(?:o(?:s(?:a(?:l[^>]*)?)?)?)?)?)?)?)?$/i;

const attr = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:'([^']*)'|"((?:[^"\\\\]|\\\\.)*)")`, 'i'));
  return m ? (m[1] ?? m[2] ?? null) : null;
};

const parseParams = (raw: string | null): Record<string, unknown> | null => {
  if (raw === null) return {};
  for (const candidate of [raw, raw.replace(/&quot;/g, '"').replace(/\\"/g, '"')]) {
    try {
      const v = JSON.parse(candidate);
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch { /* try the next form */ }
  }
  return null;
};

/** Pulls every proposal out of `text`. Unreadable tags are dropped from the text too (never shown raw). */
export const extractProposals = (text: string, streaming = false): { cleanText: string; proposals: Proposal[] } => {
  let cleanText = (text || '')
    .replace(/\{[\s\S]*?"internal_monologue"[\s\S]*?\}/g, '') // leaked brain JSON
    .replace(/```json[\s\S]*?```/g, '');

  const proposals: Proposal[] = [];
  for (const m of cleanText.match(TAG) || []) {
    const tool = attr(m, 'tool');
    const params = parseParams(attr(m, 'params'));
    if (tool && params) proposals.push({ tool, params, reason: attr(m, 'reason') || '' });
  }
  cleanText = cleanText.replace(TAG, '');
  // A tag still arriving (streaming) or cut off (reply stopped mid-tag): hide it
  cleanText = cleanText.replace(/<proposal\b[^>]*$/i, '');
  if (streaming) cleanText = cleanText.replace(PARTIAL_TAIL, '');

  cleanText = cleanText.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { cleanText, proposals };
};

/** Text a person would copy or reply to: no tool tags. */
export const visibleText = (text: string) => extractProposals(text).cleanText;
