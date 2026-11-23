import React from 'react';

/**
 * Tiny, safe Markdown renderer for chat bubbles.
 * - Builds React elements only (no innerHTML) → no XSS. Links: https only, opened safely.
 * - Supports: ***bold italic***, **bold**, __bold__, *italic*, _italic_, ~~strike~~, `code`,
 *   [text](https://…), # headings, - / * / • bullet lists, 1. / 1) numbered lists, > quotes.
 * - No regex lookbehind (unsupported on iOS < 16.4, it would crash the whole chat).
 * - While streaming, a dangling unclosed marker (e.g. "**bol") is hidden instead of shown raw.
 * - `stripMarkdown()` gives plain text (search, TTS, previews).
 */

type Kind = 'code' | 'link' | 'bolditalic' | 'bold' | 'strike' | 'italic';
interface Rule { kind: Kind; re: RegExp; leftBoundary?: boolean; noEdgeSpace?: boolean }

// Order matters only for ties at the same index (longer markers first).
const RULES: Rule[] = [
  { kind: 'code', re: /`([^`\n]+)`/g },
  { kind: 'link', re: /\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g },
  { kind: 'bolditalic', re: /\*\*\*([^*\n]+?)\*\*\*/g },
  { kind: 'bold', re: /\*\*([^*\n]+?)\*\*/g },
  { kind: 'bold', re: /__([^_\n]+?)__(?!\w)/g, leftBoundary: true },
  { kind: 'strike', re: /~~([^~\n]+?)~~/g },
  // italic may contain **bold** inside: *really **very** nice*
  { kind: 'italic', re: /\*((?:[^*\n]|\*\*[^*\n]+?\*\*)+?)\*(?![\w*])/g, leftBoundary: true, noEdgeSpace: true },
  { kind: 'italic', re: /_([^_\n]+?)_(?!\w)/g, leftBoundary: true, noEdgeSpace: true },
];

type Token = { type: 'text'; text: string } | { type: Kind; inner: string; href?: string };

const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}_*]/u.test(c);

/** Earliest valid match of a rule at or after `from` (validates boundaries manually). */
const findValid = (rule: Rule, s: string): RegExpExecArray | null => {
  rule.re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = rule.re.exec(s))) {
    const before = s[m.index - 1];
    const inner = m[1];
    const okLeft = !rule.leftBoundary || !isWordChar(before);
    const okEdges = !rule.noEdgeSpace || (!/^\s/.test(inner) && !/\s$/.test(inner));
    if (okLeft && okEdges) return m;
    rule.re.lastIndex = m.index + 1;
  }
  return null;
};

export const tokenize = (text: string): Token[] => {
  const out: Token[] = [];
  let rest = text;
  while (rest) {
    let best: { m: RegExpExecArray; rule: Rule } | null = null;
    for (const rule of RULES) {
      const m = findValid(rule, rest);
      if (m && (!best || m.index < best.m.index)) best = { m, rule };
    }
    if (!best) { out.push({ type: 'text', text: rest }); break; }
    if (best.m.index > 0) out.push({ type: 'text', text: rest.slice(0, best.m.index) });
    out.push({ type: best.rule.kind, inner: best.m[1], href: best.rule.kind === 'link' ? best.m[2] : undefined });
    rest = rest.slice(best.m.index + best.m[0].length);
  }
  return out;
};

export const renderInline = (text: string, keyPrefix = 'k'): React.ReactNode[] =>
  tokenize(text).map((t, i) => {
    const key = `${keyPrefix}-${i}`;
    if (t.type === 'text') return t.text;
    if (t.type === 'code') return <code key={key} className="px-1 py-0.5 rounded bg-black/25 text-[0.9em] font-mono">{t.inner}</code>;
    const kids = renderInline(t.inner, key);
    if (t.type === 'link') return <a key={key} href={t.href} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">{kids}</a>;
    if (t.type === 'bolditalic') return <strong key={key} className="font-semibold"><em>{kids}</em></strong>;
    if (t.type === 'bold') return <strong key={key} className="font-semibold">{kids}</strong>;
    if (t.type === 'strike') return <s key={key}>{kids}</s>;
    return <em key={key}>{kids}</em>;
  });

export const stripInline = (text: string): string =>
  tokenize(text).map((t) => (t.type === 'text' ? t.text : stripInline(t.inner))).join('');

/** Hide an unclosed trailing marker while a reply is still streaming in. */
export const hideDanglingMarkers = (text: string): string => {
  let t = text;
  for (const mark of ['***', '**', '__', '~~', '`']) {
    if ((t.split(mark).length - 1) % 2 === 1) {
      const i = t.lastIndexOf(mark);
      t = t.slice(0, i) + t.slice(i + mark.length);
    }
  }
  // a lone * / _ opener with no closer yet (e.g. "it was *really")
  const lone = /(^|\s)([*_])(\S[^*_\n]*)$/.exec(t);
  if (lone) t = t.slice(0, lone.index) + lone[1] + lone[3];
  return t;
};

type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; level: number; text: string }
  | { type: 'quote'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] };

export const parseBlocks = (text: string): Block[] => {
  const blocks: Block[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^\s*(#{1,3})\s+(.+)$/))) blocks.push({ type: 'h', level: m[1].length, text: m[2] });
    else if ((m = line.match(/^\s*[-*•]\s+(.+)$/))) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'ul') last.items.push(m[1]); else blocks.push({ type: 'ul', items: [m[1]] });
    } else if ((m = line.match(/^\s*\d{1,3}[.)]\s+(.+)$/))) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'ol') last.items.push(m[1]); else blocks.push({ type: 'ol', items: [m[1]] });
    } else if ((m = line.match(/^\s*>\s?(.*)$/))) blocks.push({ type: 'quote', text: m[1] });
    else blocks.push({ type: 'p', text: line });
  }
  return blocks;
};

export const MiniMarkdown: React.FC<{ text: string; streaming?: boolean; className?: string }> = ({ text, streaming, className }) => {
  const source = streaming ? hideDanglingMarkers(text) : text;
  return (
    <div className={`space-y-1 ${className || ''}`} style={{ maxWidth: '100%', overflowWrap: 'anywhere' }}>
      {parseBlocks(source).map((b, i) => {
        if (b.type === 'h') return <p key={i} className={`font-semibold ${b.level === 1 ? 'text-[1.1em]' : ''}`}>{renderInline(b.text, `h${i}`)}</p>;
        if (b.type === 'quote') return <p key={i} className="border-l-2 border-white/30 pl-3 opacity-90 italic">{renderInline(b.text, `q${i}`)}</p>;
        if (b.type === 'ul') return <ul key={i} className="list-disc pl-5 space-y-0.5">{b.items.map((it, j) => <li key={j}>{renderInline(it, `u${i}-${j}`)}</li>)}</ul>;
        if (b.type === 'ol') return <ol key={i} className="list-decimal pl-5 space-y-0.5">{b.items.map((it, j) => <li key={j}>{renderInline(it, `o${i}-${j}`)}</li>)}</ol>;
        return <p key={i} className="select-text" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{b.text ? renderInline(b.text, `p${i}`) : ' '}</p>;
      })}
    </div>
  );
};

/** Plain text without Markdown markers (for search highlighting, TTS, previews). */
export const stripMarkdown = (text: string): string =>
  text
    .split('\n')
    .map((line) => stripInline(line.replace(/^\s*#{1,3}\s+/, '').replace(/^\s*>\s?/, '')))
    .join('\n');
