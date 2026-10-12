"""Light, warm music (piano + pad, gentle beat from the vacancies on) + airy particle sfx for «Напиши Міші» v2.
All synthesized, click-free. Usage: python3 reels/misha2/audio.py -> build/music.wav, build/sfx.wav"""
import importlib.util, json
from pathlib import Path
import numpy as np
HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location('kit', HERE.parent / 'promo' / 'audio.py'); kit = importlib.util.module_from_spec(spec); spec.loader.exec_module(kit)
SR, env, bandpass, reverb, tone, stereo, place = kit.SR, kit.env, kit.bandpass, kit.reverb, kit.tone, kit.stereo, kit.place
cfg = json.loads((HERE / 'misha3.json').read_text()); WORDS = json.loads((HERE / 'words.json').read_text())['words']
TOTAL = cfg['total']; N = int(TOTAL * SR); rng = np.random.default_rng(9)
def W(text, after=0.0):
    for w in WORDS:
        if w['start'] >= after and w['text'].lower().strip('.,!?:—«»…').startswith(text.lower()): return w['start']
    raise KeyError(text)
mid = lambda m: 440 * 2 ** ((m - 69) / 12)
BPM = 96; BEAT = 60 / BPM; BAR = BEAT * 4
# D major: D – A – Bm – G (I–V–vi–IV), warm and hopeful
PROG = [(50, [62, 66, 69]), (45, [61, 64, 69]), (47, [62, 66, 71]), (43, [62, 67, 71])]

def piano(n, f, vel=1.0):
    t = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * f * h * t * (1 + .0004 * h * h)) * np.exp(-t * (1.6 + h * .9)) for h, a in ((1, 1), (2, .45), (3, .22), (4, .1), (5, .05)))
    return y * vel * env(n, .004, .25)

def music():
    out = np.zeros(N); t_all = np.arange(N) / SR
    tLift, tSad0, tSad1 = W('Зараз'), W('Дзвониш'), W('Привіт')
    b = 0
    while b * BAR < TOTAL:
        root, ch = PROG[b % 4]; bs = b * BAR
        sad = tSad0 - .2 <= bs < tSad1 - .3
        # pad
        s, e = int(bs * SR), min(N, int((bs + BAR + .4) * SR))
        tt = np.arange(e - s) / SR
        for m in ch:
            for det in (-.003, .003):
                out[s:e] += .05 * env(e - s, .4, .5) * sum(np.sin(2 * np.pi * mid(m) * (1 + det) * h * tt + h) * (.6 / h) * np.exp(-h * .5) for h in range(1, 4))
        # piano arpeggio (8ths), softer & sparser in the "pain" part
        pat = [0, 1, 2, 1, 0, 2, 1, 2] if not sad else [0, -1, 2, -1, 1, -1, 0, -1]
        for k, p in enumerate(pat):
            if p < 0: continue
            ns = bs + k * BEAT / 2; s2 = int(ns * SR); e2 = min(N, s2 + int(1.6 * SR))
            if s2 >= N: break
            out[s2:e2] += piano(e2 - s2, mid(ch[p] + 12), .16 if not sad else .1)
        # bass note
        e3 = min(N, s + int(BAR * SR)); out[s:e3] += .18 * piano(e3 - s, mid(root), 1.0)
        # gentle beat after the vacancies start
        if bs >= tLift - BAR * .5:
            for k in range(4):
                ks = bs + k * BEAT; s4 = int(ks * SR); e4 = min(N, s4 + int(.35 * SR))
                if s4 >= N: break
                kt = np.arange(e4 - s4) / SR
                if k in (0, 2): out[s4:e4] += .32 * env(e4 - s4, .004, .08) * np.exp(-kt * 10) * np.sin(2 * np.pi * np.cumsum(45 + 60 * np.exp(-kt * 30)) / SR)
                else:
                    m5 = int(.12 * SR); s5 = s4; e5 = min(N, s5 + m5)
                    out[s5:e5] += .05 * bandpass(rng.standard_normal(e5 - s5), lo=1800, hi=7000) * env(e5 - s5, .01, .08)
        b += 1
    out = reverb(out, 2.4, .28); out = np.tanh(out * 1.2) / 1.2
    out *= env(N, .6, 1.8); out /= np.max(np.abs(out)) + 1e-9
    return np.vstack([out, np.concatenate([np.zeros(300), out[:-300]])]) * .85

def shimmer(d=.7):
    n = int(d * SR); x = kit.glide_noise(n, 2500, 9000, .8) * np.sin(np.linspace(0, np.pi, n)) ** 2
    t = np.arange(n) / SR; bell = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * 5) for f in (1760, 2637)) * .15 * env(n, .005, .2)
    return stereo(x * .6 + bell)

def sfx():
    s = np.zeros((2, N))
    # soft airy swells where the camera turns, gentle pops for the cards, rain over the mountains
    for m in ['Золотих', 'гори', 'Варшава', 'Пиши']: place(s, kit.whoosh(1.4, 250, 2500, True), W(m) - .7, .14)
    for m in ['Ой', 'Міша', 'готелях', 'чесно', 'покоївок', 'кухарів', 'денного', 'прибирання', 'безкоштовний', 'офіційне', 'аванс', '+48']:
        place(s, stereo(kit.blip(900, .08)), W(m) - .1, .06)
    a, b = W('гори') - 1.2, W('Варшава'); n = int((b - a) * SR)
    rain = bandpass(rng.standard_normal(n), lo=1200, hi=9000) * env(n, 1.2, 1.5) * .12
    place(s, np.vstack([rain, np.roll(rain, 2400)]), a, 1.0)
    place(s, kit.chime([1318.5, 1760], 1.2, .08, 4), W('Міша') + .3, .1)
    place(s, kit.whoosh(.6, 400, 3000), W('не', W('Золотих')), .16)
    place(s, kit.chime([987.8, 1318.5, 1568, 1975.5], 1.8, .06, 2.2), W('ПІДХОДИТЬ') - .05, .2)
    place(s, kit.sting(), TOTAL - 1.9, .3)
    return s

if __name__ == '__main__':
    out = HERE / 'build'; out.mkdir(exist_ok=True)
    kit.write(out / 'music.wav', music()); kit.write(out / 'sfx.wav', sfx()); print(f'music + sfx ({TOTAL}s)')
