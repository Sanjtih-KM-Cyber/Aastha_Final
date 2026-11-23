import sys
import os; sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from engines.routing import choose_engine, detect_script, trim_for_speech
fails = 0
def check(name, cond, extra=""):
    global fails
    print(("PASS " if cond else "FAIL ") + name, "" if cond else extra)
    fails += 0 if cond else 1
r = choose_engine("Arre yaar, tension mat le, sab theek ho jayega", False, "aastha", "soft, slow")
check("romanised Hinglish -> Kokoro, aastha voice, en-us, slower", r == {"engine":"kokoro","voice":"hf_alpha","lang":"en-us","speed":0.92}, r)
r = choose_engine("अरे यार, टेंशन मत ले, सब ठीक हो जाएगा", False, "aastha", None)
check("Devanagari -> SAME Kokoro voice with lang hi", r["engine"]=="kokoro" and r["voice"]=="hf_alpha" and r["lang"]=="hi", r)
r = choose_engine("চিন্তা করো না, সব ঠিক হয়ে যাবে", False, "aastik", "warm")
check("Bengali script -> Parler (male)", r["engine"]=="parler" and r["gender"]=="male", r)
r = choose_engine("Hello there, how was your day?", False, "aarav", "excited")
check("legacy 'aarav' persona -> aastik voice, faster", r["voice"]=="hm_omega" and r["speed"]==1.06, r)
check("style tag alone no longer switches engine", choose_engine("I hear you.", False, "aastha", "whispering, emotional")["engine"]=="kokoro")
check("voice sample -> F5", choose_engine("hi", True)["engine"]=="f5")
check("emoji-only text treated as latin", detect_script("🙂🙂")=="latin")
long = ("This is a sentence. " * 120).strip()
t = trim_for_speech(long, 1500)
check("trim ends on a sentence boundary under limit", len(t) <= 1500 and t.endswith("."), (len(t), t[-20:]))
hi = ("यह एक वाक्य है। " * 200).strip()
t = trim_for_speech(hi, 1500)
check("Hindi trim ends at danda", len(t) <= 1500 and t.endswith("।"), t[-10:])
print("\nALL PASSED" if fails == 0 else f"\n{fails} FAILED")
