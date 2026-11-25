/* Humanizer: assistant-speak removed from replies (2026-11-23). Pure, no DB. */
const SRV = require('path').resolve(__dirname, '../../src');
const { humanize, createHumanizer } = require(`${SRV}/services/humanize`);

let failures = 0;
const check = (name: string, cond: boolean, extra: any = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`, cond ? '' : JSON.stringify(extra).slice(0, 400));
  if (!cond) failures++;
};

// The two replies from the owner's screenshots
const a = humanize(`It's totally okay to not know, Sanjith. Sometimes the best fun is just the simplest.\n\nHow about we just put on some music? You like happy Tamil songs, right? We could just listen for a bit. Or if you'd rather, we could just chat about anything that comes to mind. No pressure. 😊`);
check('"No pressure. 😊" dropped', !/No pressure/i.test(a) && !a.includes('😊'), a);
const b = humanize(`Haha, okay, noted! My bad, Sanjith — sometimes my "fun" meter can be a little off. 😉\n\nAlright, let's reset. What's your idea of fun right now?`);
check('"Haha, okay, noted!" opener trimmed', !/^Haha, okay, noted/i.test(b) && b.startsWith('My bad'), b);

check('filler sentences dropped anywhere', humanize("That sounds rough. I'm here for you. Let me know if you want to talk!") === 'That sounds rough.', humanize("That sounds rough. I'm here for you. Let me know if you want to talk!"));
check('only one emoji per reply', (humanize('omg yes 😂 that is so you 🤣🤣 honestly 💀').match(/\p{Extended_Pictographic}/gu) || []).length === 1);
check('"Absolutely!" / "Great question!" openers trimmed', humanize('Absolutely! Chai over coffee, always.') === 'Chai over coffee, always.' && humanize('Great question! I would pick Goa.') === 'I would pick Goa.');
check('normal human text untouched', humanize('ugh. what happened?') === 'ugh. what happened?' && humanize('okay fair, that was a bit much 😂 you pick then') === 'okay fair, that was a bit much 😂 you pick then');
check('if EVERYTHING is filler, keep the original (never send nothing)', humanize("I'm here for you.") === "I'm here for you.");
check('app tags pass through untouched', humanize('Putting something on. <proposal tool="jam" params=\'{"query":"lofi. chill"}\' reason="Playing music" />').includes('<proposal tool="jam" params=\'{"query":"lofi. chill"}\' reason="Playing music" />'));
check('Hinglish untouched', humanize('same yaar. chal kuch random baat karte hain') === 'same yaar. chal kuch random baat karte hain');

// Streaming in tiny chunks gives the same result as all at once
const text = "Haha, okay, noted! I'd pick the beach. No pressure though! What about you? 😊😊";
const h = createHumanizer();
let streamed = '';
for (const ch of text.match(/.{1,3}/gs) || []) streamed += h.push(ch);
streamed += h.flush();
check('streaming == one-shot', streamed.trim() === humanize(text), { streamed, oneShot: humanize(text) });
check('streamed result is clean', !/No pressure|Haha, okay/i.test(streamed) && (streamed.match(/😊/g) || []).length <= 1, streamed);

check('em dashes become commas', humanize('My bad, Sanjith — sometimes I overdo it.') === 'My bad, Sanjith, sometimes I overdo it.' && !humanize('wait—what? no way').includes('—'), humanize('wait—what? no way'));

// ---------------- Cut-off replies (2026-11-25: "Some chai and") ----------------
const { trimToLastSentence } = require(`${SRV}/services/humanize`);
const cut = "Oh god, Sanjith! My poor sleepy brain can't handle this level of cheekiness this early 😂 What did you really have for breakfast? Some chai and";
check('cut reply → ends at the last full sentence', trimToLastSentence(cut) === "Oh god, Sanjith! My poor sleepy brain can't handle this level of cheekiness this early 😂 What did you really have for breakfast?", trimToLastSentence(cut));
check('a finished reply is left alone', trimToLastSentence('haha okay fair.') === 'haha okay fair.' && trimToLastSentence('lol same 😂') === 'lol same 😂');
check('no full sentence at all → keep it, end with "…"', trimToLastSentence('honestly I was going to say that the') === 'honestly I was going to say that the…');
check('a tiny first sentence isn\'t used to throw most of the reply away', trimToLastSentence('Ok. so the thing about long replies is that they can run into the limit and then') .endsWith('…'));

(async () => {
  // the model layer reports WHY a stream ended: a broken connection after some text is 'broken'
  const llm = require(`${SRV}/services/llm`);
  llm._setAdaptersForTest({
    groq: { async *stream() { yield 'Some chai and '; throw Object.assign(new Error('socket hang up'), { status: 500 }); }, complete: async () => '' },
    gemini: { async *stream() { yield 'x'; }, complete: async () => '' },
  }, { groq: 1, gemini: 1 });
  let reason = '';
  let got = '';
  for await (const t of llm.streamChat([{ role: 'user', content: 'hi' }], { onFinish: (r: string) => { reason = r; } })) got += t;
  check('connection broke mid-reply → onFinish("broken"), no duplicate restart', reason === 'broken' && got === 'Some chai and ', { reason, got });

  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})();
