/* Phase 2 checks: provider layer (cooldowns, failover, no partial retry, think stripping, vision routing),
   voice-tag extraction, brain skipping, memory merge, prompt rendering. Uses fake providers — no API calls. */
process.env.SERVER_ENCRYPTION_KEY = 'k';
process.env.AI_CHAT_MODELS = 'chatA,chatB';
process.env.AI_VISION_MODELS = 'visionA';
process.env.AI_BRAIN_MODELS = 'brainA';
process.env.AI_GEMINI_FALLBACK_MODEL = 'gem';
const SRV = require('path').resolve(__dirname, '../../src');

const llm = require(`${SRV}/services/llm`);
const { createVoiceTagExtractor } = require(`${SRV}/utils/streamTags`);
const { canSkipBrain } = require(`${SRV}/services/groqService`);
const { mergeFacts } = require(`${SRV}/services/memoryService`);
const { buildCompanionPrompt, describeAge } = require(`${SRV}/prompts/companion`);

let failures = 0;
const check = (name: string, cond: boolean, extra: any = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`, cond ? '' : JSON.stringify(extra));
  if (!cond) failures++;
};
const collect = async (gen: AsyncIterable<string>) => { let s = ''; for await (const c of gen) s += c; return s; };
const err = (status: number, headers: any = {}, message = 'x') => Object.assign(new Error(message), { status, headers });

type Behaviour = (model: string, key: number, msgs: any[]) => AsyncGenerator<string>;
let calls: string[] = [];
const fake = (b: Behaviour) => ({
  stream: (m: string, k: number, msgs: any[]) => { calls.push(`${m}#${k}`); return b(m, k, msgs); },
  complete: async (m: string, k: number, msgs: any[]) => { calls.push(`${m}#${k}`); return collect(b(m, k, msgs)); },
});
const setup = (groq: Behaviour, gem: Behaviour, keys = { groq: 2, gemini: 1 }) => {
  llm._health.reset(); calls = [];
  llm._setAdaptersForTest({ groq: fake(groq), gemini: fake(gem) }, keys);
};
const msgs = [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }];

(async () => {
  // 1. Think stripping across chunk boundaries
  {
    const s = llm.createThinkStripper();
    const out = ['Hel', 'lo <thi', 'nk>secret ', 'plan</th', 'ink> world', ' <', 'b>ok'].map((c: string) => s.push(c)).join('') + s.flush();
    check('think block stripped across chunk boundaries; other tags kept', out === 'Hello  world <b>ok', out);
  }

  // 2. Rate limit → cooldown honoured (pair skipped on next request)
  setup(async function* (m, k) { if (m === 'chatA' && k === 0) throw err(429, { 'retry-after': '30' }); yield `${m}:${k}`; },
        async function* () { yield 'gem'; });
  // Key order is random by design: keep sending until key 0 has actually been hit (and rate-limited)
  for (let i = 0; i < 50 && !calls.includes('chatA#0'); i++) await collect(llm.streamChat(msgs));
  check('setup: key 0 was rate-limited at least once', calls.includes('chatA#0'), calls);
  calls = [];
  await collect(llm.streamChat(msgs));
  await collect(llm.streamChat(msgs));
  check('429 pair (chatA key0) is not called again during its cooldown', !calls.includes('chatA#0'), calls);

  // 3. Retry-After parsing incl. Groq reset format
  check('Retry-After seconds parsed', llm.retryAfterMs(err(429, { 'retry-after': '12' }), 1) === 12000);
  check('x-ratelimit-reset "2m3.5s" parsed', llm.retryAfterMs(err(429, { 'x-ratelimit-reset-requests': '2m3.5s' }), 1) === 123500);

  // 4. Decommissioned model skipped entirely afterwards
  setup(async function* (m) { if (m === 'chatA') throw err(404, {}, 'model decommissioned'); yield m; }, async function* () { yield 'gem'; });
  const r4 = await collect(llm.streamChat(msgs));
  calls = [];
  await collect(llm.streamChat(msgs));
  check('404 model falls through to next model', r4 === 'chatB', r4);
  check('dead model not retried on next request', !calls.some(c => c.startsWith('chatA')), calls);

  // 5. Mid-stream failure: keep partial text, never restart on another model
  setup(async function* (m) { yield 'Hello '; yield 'there'; throw err(500); }, async function* () { yield 'GEMINI'; });
  const r5 = await collect(llm.streamChat(msgs));
  check('partial stream kept, no duplicate restart', r5 === 'Hello there' && calls.length === 1, { r5, calls });

  // 6. Groq-wide outage → Gemini answers (reserved last slot)
  setup(async function* () { throw err(503); }, async function* () { yield 'from gemini'; }, { groq: 3, gemini: 1 });
  const r6 = await collect(llm.streamChat(msgs));
  check('all Groq candidates fail → Gemini fallback answers', r6 === 'from gemini', { r6, calls });
  check('total attempts capped at 4', calls.length <= 4, calls);

  // 7. Everything down → LlmUnavailableError
  setup(async function* () { throw err(503); }, async function* () { throw err(503); });
  let threw = false;
  try { await collect(llm.streamChat(msgs)); } catch (e: any) { threw = e instanceof llm.LlmUnavailableError; }
  check('total outage raises LlmUnavailableError (controller shows friendly message)', threw);

  // 8. Images route to the vision chain
  setup(async function* (m) { yield m; }, async function* () { yield 'gem'; });
  const withImage = [{ role: 'system', content: 's' }, { role: 'user', content: [{ type: 'text', text: 'look' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } }] }];
  check('image message uses vision model', (await collect(llm.streamChat(withImage))) === 'visionA');

  // 9. Brain task uses brain chain + JSON completion
  setup(async function* (m) { yield `<think>hmm</think>{"m":"${m}"}`; }, async function* () { yield '{}'; });
  const r9 = await llm.completeChat(msgs, { task: 'brain', json: true });
  check('brain task uses brain model; think stripped from completion', r9 === '{"m":"brainA"}', r9);

  // 10. Voice tag extraction mid-stream
  {
    const x = createVoiceTagExtractor();
    const chunks = ['Arre yaar [not a tag] chill ', '[STY', 'LE: soft, slow][TT', 'S: अरे यार आराम से]', ' bye'];
    const out = chunks.map((c: string) => x.push(c)).join('') + x.flush();
    check('STYLE/TTS removed from visible stream, other brackets kept', out === 'Arre yaar [not a tag] chill  bye', out);
    check('tag contents captured for TTS', x.captured.STYLE === 'soft, slow' && x.captured.TTS === 'अरे यार आराम से', x.captured);
  }

  // 11. Brain skipping heuristics
  check('question skips brain', canSkipBrain('how was your day?', false, false) === true);
  check('greeting skips brain', canSkipBrain('hii', false, false) === true);
  check('venting fragment still uses brain', canSkipBrain('so today my boss', false, false) === false);
  check('voice mode skips brain', canSkipBrain('anything', false, true) === true);

  // 12. Memory merge
  const merged = mergeFacts(['Has exams in March', 'Lives in Pune'],
    { new_facts: ['has exams in march.', 'Sister is Riya', ''], outdated_facts: ['Lives in Pune'] });
  check('facts: dedupe (case/punct), drop outdated, ignore empty', JSON.stringify(merged) === JSON.stringify(['Has exams in March', 'Sister is Riya']), merged);
  const many = mergeFacts([], { new_facts: Array.from({ length: 60 }, (_, i) => `fact ${i}`) });
  check('facts capped at 40, newest kept', many.length === 40 && many[39] === 'fact 59', many.length);

  // 13. Prompt renders fully
  const p = buildCompanionPrompt({ persona: 'aastha', userName: 'Bitto', userMood: 'sad', innerNote: 'needs comfort',
    facts: ['Has exams in March'], summary: 'Stressed about exams', timeContext: '11:40 PM, late night', ageContext: describeAge(new Date('2005-06-01')),
    isVoiceMode: true, voiceAvailable: false });
  check('no unreplaced {{placeholders}}', !/\{\{\w+\}\}/.test(p));
  check('prompt carries name, memory, helplines, voice-call + no-voice notes',
    p.includes('Bitto') && p.includes('Has exams in March') && p.includes('14416') && p.includes('# Voice call') && p.includes('used up for today'));
  check('Aastik prompt forbids romantic pet names', buildCompanionPrompt({ persona: 'aastik', userName: 'A', userMood: 'neutral', facts: [], timeContext: 'x', voiceAvailable: true }).includes('No romantic pet names'));

  console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
