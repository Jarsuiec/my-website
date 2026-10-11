import json, subprocess, sys
S = sys.argv[1]; SRC = sys.argv[2]
TEMPO = 1.10
r = json.load(open(f'{S}/asr/words.json'))
words = [{'w': c['text'].strip(), 's': c['timestamp'][0], 'e': c['timestamp'][1]} for c in r['chunks']]
# split into sentences on pauses
sents, cur = [], [words[0]]
for a, b in zip(words, words[1:]):
    if b['s'] - a['e'] > 0.35:
        sents.append(cur); cur = []
    cur.append(b)
sents.append(cur)
# gap after each sentence (seconds, in source time before tempo)
default_gap = 0.30
special = {3: 0.75, 8: 0.70, 15: 0.45, 17: 0.40, 18: 0.42}
PAD_IN, PAD_OUT = 0.04, 0.10
parts, out_sents, t = [], [], 0.0
for i, s in enumerate(sents):
    a = max(0, s[0]['s'] - PAD_IN); b = s[-1]['e'] + PAD_OUT
    gap = special.get(i, default_gap) - PAD_IN - PAD_OUT
    parts.append((a, b, max(gap, 0.05)))
    ws = [{'w': w['w'], 's': round((t + w['s'] - a) / TEMPO, 3), 'e': round((t + w['e'] - a) / TEMPO, 3)} for w in s]
    out_sents.append({'i': i, 'text': ' '.join(w['w'] for w in s), 's': ws[0]['s'], 'e': ws[-1]['e'], 'words': ws})
    t += (b - a) + max(gap, 0.05)
LEAD = 0.6  # silence before voice starts (for intro hit)
for s in out_sents:
    s['s'] += LEAD; s['e'] += LEAD
    for w in s['words']: w['s'] = round(w['s'] + LEAD, 3); w['e'] = round(w['e'] + LEAD, 3)
f = []
for k, (a, b, g) in enumerate(parts):
    f.append(f"[0:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st={b-a-0.03:.3f}:d=0.03,apad=pad_dur={g:.3f}[p{k}]")
f.append(''.join(f'[p{k}]' for k in range(len(parts))) + f"concat=n={len(parts)}:v=0:a=1,atempo={TEMPO},adelay={int(LEAD*1000)},aresample=48000[out]")
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', SRC, '-filter_complex', ';'.join(f), '-map', '[out]', '-ac', '1', '-ar', '48000', f'{S}/build/voice.wav'], check=True)
total = LEAD + t / TEMPO
json.dump({'duration': round(total, 3), 'sentences': out_sents}, open(f'{S}/build/timing.json', 'w'), ensure_ascii=False, indent=1)
for s in out_sents: print(f"{s['i']:2d} {s['s']:6.2f}-{s['e']:6.2f} {s['text']}")
print('voice total', total)
