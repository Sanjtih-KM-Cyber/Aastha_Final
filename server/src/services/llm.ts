/**
 * LLM provider layer (ROADMAP A1, A3, A7, A8).
 *
 * - One ordered model chain per task (configurable via env), Groq first, Gemini as the last resort.
 * - Per key+model cooldowns: a 429 honours `Retry-After` and that pair is skipped (not hammered)
 *   until it expires; 5xx cools briefly; 404/decommissioned marks the model dead for an hour.
 * - Streaming never restarts once text has reached the user (no duplicated/garbled replies).
 * - Reasoning models are asked to hide their thinking, and any <think>…</think> that still
 *   arrives is stripped before it can reach the user.
 * - Image messages go to a vision-capable model instead of being silently dropped.
 */
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ContentPart = { type: string; text?: string; image_url?: { url: string } };
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export type Task = 'chat' | 'vision' | 'brain' | 'think';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const list = (v: string | undefined, fallback: string[]) =>
  v ? v.split(',').map((s) => s.trim()).filter(Boolean) : fallback;

/** Ordered model chains. Override per deploy without code changes. */
export const MODEL_CHAINS: Record<Task, string[]> = {
  // Warm, coherent conversation. No 8B models, they hallucinate too much for a companion.
  chat: list(process.env.AI_CHAT_MODELS, [
    'llama-3.3-70b-versatile',
    'qwen/qwen3-32b',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
  ]),
  // Messages that contain images.
  vision: list(process.env.AI_VISION_MODELS, [
    'meta-llama/llama-4-maverick-17b-128e-instruct',
    'meta-llama/llama-4-scout-17b-16e-instruct',
  ]),
  // "Think deeper" mode: reasoning models whose reasoning is returned separately (never in the reply).
  think: list(process.env.AI_THINK_MODELS, ['qwen/qwen3-32b', 'openai/gpt-oss-120b']),
  // Small JSON decisions (mood / listen-vs-reply / chips).
  brain: list(process.env.AI_BRAIN_MODELS, ['openai/gpt-oss-20b', 'llama-3.3-70b-versatile']),
};

const GEMINI_FALLBACK_MODEL = process.env.AI_GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash';
const MAX_ATTEMPTS = 4; // total provider calls per request before giving up

const groqKeys = list(process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY, []);
const geminiKeys = list(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || process.env.API_KEY, []);

// ---------------------------------------------------------------------------
// Health tracking (cooldowns / dead models)
// ---------------------------------------------------------------------------
const cooldownUntil = new Map<string, number>(); // `${keyIdx}|${model}` -> epoch ms
const deadModelUntil = new Map<string, number>(); // model -> epoch ms

const pairKey = (keyIdx: number, model: string) => `${keyIdx}|${model}`;
const now = () => Date.now();

export const _health = {
  reset() {
    cooldownUntil.clear();
    deadModelUntil.clear();
  },
  snapshot() {
    return { cooldowns: Object.fromEntries(cooldownUntil), dead: Object.fromEntries(deadModelUntil) };
  },
};

const getHeader = (headers: any, name: string): string | undefined => {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name) ?? undefined;
  return headers[name] ?? headers[name.toLowerCase()];
};

/** Parses Retry-After (seconds or HTTP date) and Groq's x-ratelimit-reset-* style ("7.66s", "2m59.5s"). */
export const retryAfterMs = (err: any, fallbackMs: number): number => {
  const ra = getHeader(err?.headers, 'retry-after');
  if (ra) {
    const secs = Number(ra);
    if (!isNaN(secs)) return Math.max(1000, secs * 1000);
    const date = Date.parse(ra);
    if (!isNaN(date)) return Math.max(1000, date - now());
  }
  const reset = getHeader(err?.headers, 'x-ratelimit-reset-requests') || getHeader(err?.headers, 'x-ratelimit-reset-tokens');
  if (reset) {
    const m = /(?:(\d+)m)?(?:([\d.]+)s)?/.exec(reset);
    if (m && (m[1] || m[2])) return Math.max(1000, (Number(m[1] || 0) * 60 + Number(m[2] || 0)) * 1000);
  }
  return fallbackMs;
};

export const classifyError = (err: any): 'rate_limit' | 'model_gone' | 'server' | 'client' => {
  const status = err?.status;
  const msg = String(err?.message || '').toLowerCase();
  if (status === 429) return 'rate_limit';
  if (status === 404 || msg.includes('decommissioned') || msg.includes('does not exist') || msg.includes('model_not_found'))
    return 'model_gone';
  if (status === undefined || status >= 500) return 'server';
  return 'client'; // 400/401/403/413, retrying the same request elsewhere may still help (e.g. other key)
};

const recordFailure = (keyIdx: number, model: string, err: any) => {
  const kind = classifyError(err);
  if (kind === 'rate_limit') cooldownUntil.set(pairKey(keyIdx, model), now() + retryAfterMs(err, 20_000));
  else if (kind === 'model_gone') deadModelUntil.set(model, now() + 60 * 60_000);
  else if (kind === 'server') cooldownUntil.set(pairKey(keyIdx, model), now() + 10_000);
  else cooldownUntil.set(pairKey(keyIdx, model), now() + 60_000); // e.g. invalid key
  console.warn(`[LLM] ${model} (key ${keyIdx}) failed: ${kind} ${err?.status ?? ''} ${String(err?.message || '').slice(0, 120)}`);
};

/** Candidate (model, keyIdx) pairs in priority order, skipping dead models and cooling pairs. */
export const candidates = (models: string[], keyCount: number): Array<{ model: string; keyIdx: number }> => {
  const out: Array<{ model: string; keyIdx: number }> = [];
  const t = now();
  for (const model of models) {
    if ((deadModelUntil.get(model) || 0) > t) continue;
    const start = keyCount > 0 ? Math.floor(Math.random() * keyCount) : 0; // spread load across keys
    for (let i = 0; i < keyCount; i++) {
      const keyIdx = (start + i) % keyCount;
      if ((cooldownUntil.get(pairKey(keyIdx, model)) || 0) > t) continue;
      out.push({ model, keyIdx });
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// <think> stripping (works across chunk boundaries)
// ---------------------------------------------------------------------------
export const createThinkStripper = () => {
  let buffer = '';
  let inThink = false;
  const OPEN = '<think>';
  const CLOSE = '</think>';

  const push = (chunk: string): string => {
    buffer += chunk;
    let out = '';
    while (buffer.length) {
      if (inThink) {
        const end = buffer.indexOf(CLOSE);
        if (end === -1) {
          buffer = buffer.slice(Math.max(0, buffer.length - CLOSE.length)); // keep possible partial tag
          return out;
        }
        buffer = buffer.slice(end + CLOSE.length);
        inThink = false;
        continue;
      }
      const start = buffer.indexOf(OPEN);
      if (start === -1) {
        // Hold back a possible partial "<think" at the end
        let hold = 0;
        for (let k = Math.min(OPEN.length - 1, buffer.length); k > 0; k--) {
          if (OPEN.startsWith(buffer.slice(-k))) { hold = k; break; }
        }
        out += buffer.slice(0, buffer.length - hold);
        buffer = buffer.slice(buffer.length - hold);
        return out;
      }
      out += buffer.slice(0, start);
      buffer = buffer.slice(start + OPEN.length);
      inThink = true;
    }
    return out;
  };

  const flush = (): string => {
    const rest = inThink ? '' : buffer;
    buffer = '';
    return rest;
  };

  return { push, flush };
};

// ---------------------------------------------------------------------------
// Provider adapters
// ---------------------------------------------------------------------------
const groqClients = new Map<number, Groq>();
const groqClient = (idx: number) => {
  if (!groqClients.has(idx)) groqClients.set(idx, new Groq({ apiKey: groqKeys[idx], maxRetries: 0 }));
  return groqClients.get(idx)!;
};

const textOnly = (c: string | ContentPart[]) =>
  typeof c === 'string' ? c : c.filter((p) => p.type === 'text').map((p) => p.text || '').join('\n') || '[image]';

const hasImages = (messages: LlmMessage[]) =>
  messages.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === 'image_url'));

/** Only the newest user message keeps its images; older ones become text (keeps payloads small). */
const prepareForGroq = (messages: LlmMessage[], allowImages: boolean) => {
  const lastUserIdx = messages.map((m) => m.role).lastIndexOf('user');
  return messages.map((m, i) => ({
    role: m.role,
    content: allowImages && i === lastUserIdx && Array.isArray(m.content) ? m.content : textOnly(m.content),
  }));
};

/** Reasoning models: ask the API to keep thinking out of the content. */
const reasoningParams = (model: string, showReasoning = false): Record<string, any> => {
  // Qwen3 thinks by default, and HIDDEN thinking still uses max_tokens: with a short reply budget it could think
  // the whole budget away and answer with nothing (the app then showed "I'm a little overwhelmed…").
  // Normal chat / JSON → thinking OFF. Only "think deeper" (showReasoning) keeps it, shown separately.
  if (model.startsWith('qwen/qwen3')) return showReasoning ? { reasoning_format: 'parsed' } : { reasoning_effort: 'none' };
  if (model.startsWith('openai/gpt-oss'))
    return showReasoning ? { reasoning_effort: 'medium', include_reasoning: true } : { reasoning_effort: 'low', include_reasoning: false };
  return {};
};

interface CallOpts {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  /** Receives the model's reasoning separately (think task). Never mixed into the reply text. */
  onReasoning?: (text: string) => void;
  /**
   * Why the stream ended (2026-11-25, replies cut mid-sentence): 'stop' = the model finished, 'length' = it hit
   * max tokens, 'broken' = the connection died after some text (we never restart, it would duplicate text).
   */
  onFinish?: (reason: FinishReason) => void;
}
export type FinishReason = 'stop' | 'length' | 'broken';

/** A stream piece: reply text, or reasoning (kept separate). */
export type StreamPiece = string | { reasoning: string };

export interface ProviderAdapter {
  stream(model: string, keyIdx: number, messages: LlmMessage[], opts: CallOpts): AsyncIterable<StreamPiece>;
  complete(model: string, keyIdx: number, messages: LlmMessage[], opts: CallOpts): Promise<string>;
}

const groqAdapter: ProviderAdapter = {
  async *stream(model, keyIdx, messages, opts) {
    const body: any = {
      model,
      messages: prepareForGroq(messages, model.includes('llama-4')),
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 1024,
      stream: true,
      ...reasoningParams(model, !!opts.onReasoning),
    };
    const completion: any = await groqClient(keyIdx).chat.completions.create(body);
    let finish = '';
    for await (const chunk of completion) {
      const delta = chunk?.choices?.[0]?.delta || {};
      if (chunk?.choices?.[0]?.finish_reason) finish = String(chunk.choices[0].finish_reason);
      if (delta.reasoning) yield { reasoning: String(delta.reasoning) };
      if (delta.content) yield delta.content as string;
    }
    opts.onFinish?.(finish === 'length' ? 'length' : 'stop');
  },
  async complete(model, keyIdx, messages, opts) {
    const body: any = {
      model,
      messages: prepareForGroq(messages, model.includes('llama-4')),
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.maxTokens ?? 500,
      response_format: opts.json ? { type: 'json_object' } : undefined,
      ...reasoningParams(model),
    };
    const completion: any = await groqClient(keyIdx).chat.completions.create(body);
    return completion?.choices?.[0]?.message?.content || '';
  },
};

const toGemini = (messages: LlmMessage[]) => {
  const system = messages.filter((m) => m.role === 'system').map((m) => textOnly(m.content)).join('\n\n');
  const convo = messages.filter((m) => m.role !== 'system');
  const contents = convo.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: Array.isArray(m.content)
      ? m.content.map((p) => {
          if (p.type === 'image_url' && p.image_url?.url?.startsWith('data:')) {
            const [meta, data] = p.image_url.url.split(',');
            const mimeType = meta.slice(5).split(';')[0] || 'image/jpeg';
            return { inlineData: { mimeType, data } };
          }
          return { text: p.text || '' };
        })
      : [{ text: m.content || ' ' }],
  }));
  return { system, contents };
};

const geminiAdapter: ProviderAdapter = {
  async *stream(model, keyIdx, messages, opts) {
    const { system, contents } = toGemini(messages);
    const gm = new GoogleGenerativeAI(geminiKeys[keyIdx]).getGenerativeModel({
      model,
      systemInstruction: system || undefined,
      generationConfig: { temperature: opts.temperature ?? 0.7, maxOutputTokens: opts.maxTokens ?? 1024 },
    });
    const result = await gm.generateContentStream({ contents });
    let finish = '';
    for await (const chunk of result.stream) {
      const fr = (chunk as any)?.candidates?.[0]?.finishReason;
      if (fr) finish = String(fr);
      const text = chunk.text();
      if (text) yield text;
    }
    opts.onFinish?.(finish === 'MAX_TOKENS' ? 'length' : 'stop');
  },
  async complete(model, keyIdx, messages, opts) {
    const { system, contents } = toGemini(messages);
    const gm = new GoogleGenerativeAI(geminiKeys[keyIdx]).getGenerativeModel({
      model,
      systemInstruction: system || undefined,
      generationConfig: {
        temperature: opts.temperature ?? 0.6,
        maxOutputTokens: opts.maxTokens ?? 500,
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      },
    });
    const result = await gm.generateContent({ contents });
    return result.response.text();
  },
};

// Adapters are swappable for tests.
const adapters = { groq: groqAdapter, gemini: geminiAdapter };
export const _setAdaptersForTest = (a: Partial<typeof adapters>, keys?: { groq?: number; gemini?: number }) => {
  Object.assign(adapters, a);
  if (keys?.groq !== undefined) groqKeys.splice(0, groqKeys.length, ...Array(keys.groq).fill('test'));
  if (keys?.gemini !== undefined) geminiKeys.splice(0, geminiKeys.length, ...Array(keys.gemini).fill('test'));
};

type Attempt = { provider: 'groq' | 'gemini'; model: string; keyIdx: number };

const plan = (task: Task, messages: LlmMessage[]): Attempt[] => {
  const effective: Task = task === 'chat' && hasImages(messages) ? 'vision' : task;
  const groqAttempts: Attempt[] = candidates(MODEL_CHAINS[effective], groqKeys.length).map((c) => ({ provider: 'groq', ...c }));
  const geminiAttempts: Attempt[] = candidates([GEMINI_FALLBACK_MODEL], geminiKeys.length)
    .slice(0, 1)
    .map((c) => ({ provider: 'gemini', ...c }));
  // Reserve the last slot for Gemini so a Groq-wide outage still gets an answer.
  return [...groqAttempts.slice(0, MAX_ATTEMPTS - geminiAttempts.length), ...geminiAttempts];
};

export class LlmUnavailableError extends Error {
  constructor() {
    super('All AI providers are busy or unavailable');
    this.name = 'LlmUnavailableError';
  }
}

/**
 * Streams a reply. Tries providers until one produces the first chunk; after that it never
 * switches (a mid-stream failure just ends the stream, partial text is kept, not duplicated).
 */
export async function* streamChat(
  messages: LlmMessage[],
  opts: CallOpts & { task?: Task } = {}
): AsyncGenerator<string> {
  const attempts = plan(opts.task || 'chat', messages);
  for (const a of attempts) {
    const stripper = createThinkStripper();
    let started = false;
    try {
      for await (const piece of adapters[a.provider].stream(a.model, a.keyIdx, messages, opts)) {
        if (typeof piece !== 'string') {
          if (opts.onReasoning && piece.reasoning) opts.onReasoning(piece.reasoning);
          continue;
        }
        const text = stripper.push(piece);
        if (text) {
          started = true;
          yield text;
        }
      }
      const tail = stripper.flush();
      if (tail) {
        started = true;
        yield tail;
      }
      if (started) return;
      // Empty completion, treat like a soft failure and try the next candidate
      console.warn(`[LLM] ${a.model} returned an empty stream; trying next.`);
    } catch (err) {
      recordFailure(a.keyIdx, a.model, err);
      if (started) {
        console.warn('[LLM] Stream broke after partial output, ending without retry to avoid duplicate text.');
        opts.onFinish?.('broken');
        return;
      }
    }
  }
  throw new LlmUnavailableError();
}

/** Non-streaming completion (JSON tasks, summaries). */
export const completeChat = async (messages: LlmMessage[], opts: CallOpts & { task?: Task } = {}): Promise<string> => {
  for (const a of plan(opts.task || 'chat', messages)) {
    try {
      const raw = await adapters[a.provider].complete(a.model, a.keyIdx, messages, { ...opts, onReasoning: undefined });
      const text = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      if (text) return text;
    } catch (err) {
      recordFailure(a.keyIdx, a.model, err);
    }
  }
  throw new LlmUnavailableError();
};
