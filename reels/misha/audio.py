"""Music + sound design for «Напиши Міші» (all synthesized, royalty-free, click-free envelopes).
Reuses the synth toolkit from reels/promo/audio.py. Usage: python3 reels/misha/audio.py -> build/music.wav, build/sfx.wav
"""
import importlib.util
import json
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location('kit', HERE.parent / 'promo' / 'audio.py')
kit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kit)
SR, env, bandpass, reverb, tone, stereo, place = kit.SR, kit.env, kit.bandpass, kit.reverb, kit.tone, kit.stereo, kit.place
whoosh, riser, impact, chime, blip, pop, thunk, swish = kit.whoosh, kit.riser, kit.impact, kit.chime, kit.blip, kit.pop, kit.thunk, kit.swish

cfg = json.loads((HERE / 'misha.json').read_text())
WORDS = json.loads((HERE / 'words.json').read_text())['words']
T = {s['id']: s['t'] for s in cfg['scenes']}
TOTAL = cfg['scenes'][-1]['t'][1]
N = int(TOTAL * SR)
rng = np.random.default_rng(5)


def W(text, after=0.0):
    k = text.lower()
    for w in WORDS:
        if w['start'] >= after and w['text'].lower().strip('.,!?:—«»…').startswith(k):
            return w['start']
    raise KeyError(text)


# 120 bpm pop
kit.BEAT = 60 / 120
kit.BAR = kit.BEAT * 4
POP = [('C', 'CEG'), ('G', 'GBD'), ('A', 'ACE'), ('F', 'FAC')]


def sad_trombone():
    out = []
    for i, f in enumerate([233.08, 220.0, 207.65, 196.0]):
        d = .32 if i < 3 else .9
        n = int(d * SR)
        t = np.arange(n) / SR
        fr = f * (1 + (.012 * np.sin(2 * np.pi * 6 * t) if i == 3 else 0)) * (1 - (.03 * t if i == 3 else 0))
        y = tone(n, np.full(n, fr) if np.isscalar(fr) else fr, ((1, 1), (2, .6), (3, .4), (4, .25), (5, .12)))
        out.append(y * env(n, .03, .08))
    x = np.concatenate(out)
    return stereo(reverb(bandpass(x, hi=2500), .8, .2) * .5)


def rimshot():
    a, b = int(.18 * SR), int(.7 * SR)
    t1 = np.arange(a) / SR
    tom1 = tone(a, 200 * np.exp(-t1 * 3)) * np.exp(-t1 * 14) * env(a, .003, .04)
    tom2 = tone(a, 150 * np.exp(-t1 * 3)) * np.exp(-t1 * 14) * env(a, .003, .04)
    tb = np.arange(b) / SR
    cym = bandpass(rng.standard_normal(b), lo=5000, hi=14000) * np.exp(-tb * 5) * env(b, .004, .2) * .5
    x = np.zeros(int(.25 * SR) * 2 + b)
    x[:a] += tom1
    x[int(.2 * SR):int(.2 * SR) + a] += tom2
    s = int(.42 * SR)
    x[s:s + a] += tom2 * .9
    x[s:s + b] += cym
    return stereo(x * .8)


def ring():
    d, n = 1.15, int(1.15 * SR)
    t = np.arange(n) / SR
    y = (np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 480 * t)) * .4
    gate = ((t % .6) < .4).astype(float)
    k = int(.01 * SR)
    gate = np.convolve(gate, np.ones(k) / k, 'same')  # soften the gate edges
    return stereo(bandpass(y * gate * env(n, .01, .05), lo=300, hi=3000))


def dtmf(i):
    pairs = [(697, 1209), (770, 1336), (852, 1477), (941, 1336)]
    lo, hi = pairs[i % 4]
    n = int(.09 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * lo * t) + np.sin(2 * np.pi * hi * t)) * .3 * env(n, .005, .02)


def boing():
    n = int(.45 * SR)
    t = np.arange(n) / SR
    f = 180 + 120 * np.sin(2 * np.pi * 9 * t) * np.exp(-t * 4) + 200 * np.exp(-t * 6)
    return stereo(tone(n, f, ((1, 1), (2, .2))) * np.exp(-t * 4) * env(n, .005, .08) * .7)


def build_music():
    parts = []

    def add(t0, t1, fade=.08, **kw):
        y = kit.section(t0, t1, prog=POP, **kw)
        y *= env(len(y), fade, fade)
        parts.append((t0, y))
    add(0, T['pain'][0] + .05, pad=.05, bass=.34, kick=.6, arp=.06, shaker=.05)
    add(T['pain'][0], T['meet'][0] + .05, pad=.05, bass=.18, kick=.0, arp=.0, lp=900)          # comic drop
    add(T['meet'][0], T['gold'][0] + .05, pad=.06, bass=.3, kick=.5, arp=.06, shaker=.04)
    add(T['gold'][0], T['jobs'][0] + .05, pad=.06, bass=.24, kick=.35, arp=.07, lp=5000)
    add(T['jobs'][0], T['terms'][0] + .05, pad=.06, bass=.36, kick=.62, arp=.07, shaker=.06)
    add(T['terms'][0], T['contact'][0] + .05, pad=.06, bass=.32, kick=.55, arp=.06, shaker=.05)
    add(T['contact'][0], T['final'][0] + .05, pad=.05, bass=.32, kick=.55, arp=.05, shaker=.04)
    add(T['final'][0], TOTAL, pad=.07, bass=.38, kick=.65, arp=.08, shaker=.06, fade=.2)
    out = np.zeros(N)
    for t0, y in parts:
        s = int(t0 * SR)
        e = min(N, s + len(y))
        out[s:e] += y[:e - s]
    out = reverb(out, 1.2, .16)
    out = np.tanh(out * 1.3) / 1.3
    out *= env(N, .05, 1.2)
    out /= np.max(np.abs(out)) + 1e-9
    return np.vstack([out, np.concatenate([np.zeros(200), out[:-200]])]) * .85


def build_sfx():
    s = np.zeros((2, N))
    # hook
    place(s, impact(1.0, bright=True), 0.0, .45)
    place(s, boing(), .1, .35)
    for w in ('роботу', 'Польщі'):
        place(s, stereo(thunk()), W(w), .45)
    place(s, stereo(pop(.14)), W('Знайоме') - .05, .35)
    # pain
    place(s, whoosh(.4, 400, 3000), T['pain'][0] - .2, .25)
    place(s, ring(), W('Дзвониш'), .22)
    place(s, stereo(blip(900, .12)), W('там'), .2)
    place(s, stereo(pop(.14)), W('Ой') - .1, .35)
    tLast = W('минулого')
    place(s, impact(.9), tLast + .2, .45)
    place(s, sad_trombone(), tLast + .5, .55)
    # meet
    place(s, whoosh(.5, 300, 4000), T['meet'][0] - .25, .28)
    place(s, stereo(pop(.18)), W('Привіт') - .15, .4)
    place(s, chime([1046.5, 1318.5], .8, .06, 5), W('Міша'), .16)
    tN1 = W('без', W('Польщі', 12))
    for i, tt in enumerate([W('рекрутер'), W('готелях') - .05, tN1, W('без', tN1 + .1)]):
        place(s, stereo(blip(900 + i * 150, .1)), tt, .25)
    # gold
    tGold, tMtn, tSouth, tHonest = W('Золотих'), W('гори'), W('півдні'), W('чесно')
    tNo = W('не', tGold)
    place(s, chime([1568, 2093, 2637], 1.0, .05, 4), tGold - .1, .14)
    place(s, stereo(kit.swish(.18)), tNo, .35)
    place(s, stereo(kit.swish(.18)), tNo + .15, .35)
    place(s, boing(), tNo + .6, .3)
    place(s, whoosh(.45, 300, 2500), tMtn - .3, .25)
    for i in range(6):
        place(s, stereo(blip(600 + i * 60, .07)), tSouth - .15 + i * .06, .14)
    place(s, rimshot(), tSouth + .12, .32)
    place(s, impact(.8), tHonest - .05, .35)
    place(s, stereo(pop(.14)), W('поїдеш') - .45, .3)
    # jobs
    place(s, stereo(thunk()), W('Зараз'), .45)
    for v in cfg['vacancies']:
        place(s, stereo(thunk()), W(v['word']) + .05, .35)
        place(s, stereo(pop(.12)), W(v['word']), .22)
    # cities
    place(s, whoosh(.5, 300, 3000), T['cities'][0] - .2, .25)
    last = -1
    for i, name in enumerate(['Варшава', 'Гданськ', 'Краків', 'Міжздроє', 'Миколайки', 'Оструда']):
        tt = max(W(name) - .05, last + .32); last = tt
        place(s, stereo(blip(1100 + i * 110, .1)), tt + .15, .3)
    place(s, stereo(pop(.14)), W('не', W('ще', W('Оструда'))) - .2, .3)
    # terms
    for i, w in enumerate(['безкоштовний', 'офіційне', 'аванс']):
        place(s, whoosh(.3, 600, 3000), W(w) - .3, .2)
        place(s, chime([1318.5 + i * 200], .6, 0, 6), W(w) - .05, .16)
    # contact
    for w in ('Телеграм', 'Вотсап', 'Месенджер'):
        place(s, stereo(pop(.14)), W(w) - .1, .35)
    place(s, whoosh(.4, 500, 2500), W('дзвони', 40) - .1, .2)
    for g, txt in enumerate(['+48', '731', '292', '633']):
        for k in range(3):
            place(s, stereo(dtmf(g + k)), W(txt) + k * .11, .22)
    # final
    place(s, whoosh(.5, 300, 4000), T['final'][0] - .25, .28)
    place(s, stereo(pop(.18)), W('Напиши', 46) - .1, .4)
    tFit = W('ПІДХОДИТЬ')
    place(s, impact(1.2, bright=True), tFit - .05, .4)
    place(s, chime([1046.5, 1318.5, 1568, 2093], 1.6, .05, 2.5), tFit, .22)
    place(s, kit.sting(), TOTAL - 1.85, .4)
    return s


if __name__ == '__main__':
    out = HERE / 'build'
    out.mkdir(exist_ok=True)
    kit.write(out / 'music.wav', build_music())
    kit.write(out / 'sfx.wav', build_sfx())
    print(f'music.wav + sfx.wav ({TOTAL:.2f}s)')
