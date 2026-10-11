"""Music + sound design for the PC MASTER WARSZAWA promo, synced to words.json.

All synthesis is original (royalty-free). Every envelope starts and ends at zero, so nothing clicks.
Usage: python3 reels/promo/audio.py   -> writes build/music.wav and build/sfx.wav
"""
import json
import wave
from pathlib import Path

import numpy as np

SR = 48000
HERE = Path(__file__).parent
rng = np.random.default_rng(11)
cfg = json.loads((HERE / 'promo.json').read_text())
WORDS = json.loads((HERE / 'words.json').read_text())['words']
T = {s['id']: s['t'] for s in cfg['scenes']}
TOTAL = cfg['scenes'][-1]['t'][1]
N = int(TOTAL * SR)


def W(text, after=0.0):
    k = text.lower()
    for w in WORDS:
        clean = w['text'].lower().strip('.,!?:—«»')
        if w['start'] >= after and clean.startswith(k):
            return w['start']
    raise KeyError(text)


# ---------------------------------------------------------------- helpers
def env(n, a, r):
    e = np.ones(n)
    a, r = min(max(1, int(a * SR)), n // 2), min(max(1, int(r * SR)), n // 2)
    e[:a] = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, a))
    e[n - r:] = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, r))
    return e


def bandpass(x, lo=None, hi=None):
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(spec * m, len(x))


def reverb(x, sec=1.6, mix=0.22):
    n = int(sec * SR)
    t = np.arange(n) / SR
    ir = bandpass(rng.standard_normal(n) * np.exp(-t * 3.4), hi=7000)
    ir /= np.sqrt(np.sum(ir ** 2))
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x)]
    return x * (1 - mix) + wet * mix


def glide_noise(n, f0, f1, width=0.7):
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    hop = 1024
    win = np.hanning(hop * 2)
    for s in range(0, n, hop):
        seg = noise[s:s + hop * 2]
        if len(seg) < hop * 2:
            seg = np.pad(seg, (0, hop * 2 - len(seg)))
        fc = f0 * (f1 / f0) ** (s / max(1, n))
        y = bandpass(seg * win, lo=fc * (1 - width / 2), hi=fc * (1 + width))
        e = min(n, s + hop * 2)
        out[s:e] += y[:e - s]
    return out / (np.max(np.abs(out)) + 1e-9)


def tone(n, f, harm=((1, 1),), decay=0.0):
    t = np.arange(n) / SR
    fr = f if np.isscalar(f) else f
    phase = 2 * np.pi * (np.cumsum(fr) / SR if not np.isscalar(fr) else fr * t)
    y = sum(a * np.sin(phase * h) for h, a in harm)
    return y * (np.exp(-t * decay) if decay else 1)


def stereo(x, pan=0.0):
    return np.vstack([x * (1 - pan) / 1.4, x * (1 + pan) / 1.4]) if pan else np.vstack([x, x]) * 0.75


def place(track, clip, at, gain=1.0):
    if clip.ndim == 1:
        clip = stereo(clip)
    s = int(at * SR)
    if s < 0:
        clip, s = clip[:, -s:], 0
    e = min(track.shape[1], s + clip.shape[1])
    if e > s:
        track[:, s:e] += clip[:, :e - s] * gain


# ---------------------------------------------------------------- sfx library
def whoosh(d=0.5, f0=300, f1=4000, pan_sweep=True):
    n = int(d * SR)
    x = glide_noise(n, f0, f1) * np.sin(np.linspace(0, np.pi, n)) ** 2
    if pan_sweep:
        p = np.linspace(-.7, .7, n)
        return np.vstack([x * (1 - p) / 1.4, x * (1 + p) / 1.4])
    return stereo(x)


def riser(d=1.0, f0=400, f1=7000):
    n = int(d * SR)
    x = glide_noise(n, f0, f1) * np.linspace(0, 1, n) ** 2.2 * env(n, .01, .04)
    return stereo(x)


def impact(d=1.2, bright=False):
    n = int(d * SR)
    t = np.arange(n) / SR
    sub = tone(n, 38 + 55 * np.exp(-t * 7)) * np.exp(-t * 3.5)
    body = bandpass(rng.standard_normal(n), lo=60, hi=2500 if bright else 900) * np.exp(-t * 14) * .6
    x = reverb((sub + body) * env(n, .004, .3), 1.4, .3) * env(n, .002, .2)
    return stereo(x / (np.max(np.abs(x)) + 1e-9))


def chime(freqs, d=1.4, gap=0.0, decay=3.5):
    n = int((d + gap * len(freqs)) * SR)
    out = np.zeros(n)
    for i, f in enumerate(freqs):
        m = int(d * SR)
        y = tone(m, f, ((1, 1), (2, .25), (3, .08)), decay) * env(m, .005, .3)
        s = int(i * gap * SR)
        out[s:s + m] += y
    return stereo(reverb(out, 1.8, .3) * env(n, .002, .15))


def blip(f=1200, d=0.09, gain=1.0):
    n = int(d * SR)
    return tone(n, np.linspace(f, f * 1.5, n), ((1, 1),), 30) * env(n, .004, .03) * gain


def pop(d=0.12):
    n = int(d * SR)
    t = np.arange(n) / SR
    return tone(n, 300 + 900 * np.exp(-t * 40)) * env(n, .003, .05) * np.exp(-t * 25)


def thunk(d=0.25):
    n = int(d * SR)
    t = np.arange(n) / SR
    x = tone(n, 90 + 60 * np.exp(-t * 30)) * np.exp(-t * 18) + bandpass(rng.standard_normal(n), lo=200, hi=1500) * np.exp(-t * 60) * .4
    return x * env(n, .003, .05)


def tick(f=1800, d=0.05):
    n = int(d * SR)
    return tone(n, f, ((1, 1), (2.7, .3)), 70) * env(n, .003, .02)


def swish(d=0.22):
    n = int(d * SR)
    return bandpass(rng.standard_normal(n), lo=2500, hi=9000) * np.sin(np.linspace(0, np.pi, n)) ** 3


def fan_whine(d, f0=700, f1=2600):
    n = int(d * SR)
    t = np.linspace(0, 1, n)
    f = f0 * (f1 / f0) ** (t ** 1.5)
    x = tone(n, f, ((1, .5), (2, .3), (3, .15))) * .4 + glide_noise(n, 500, 3000) * .6
    return x * (t ** 1.4) * env(n, .05, .08)


def jet(d=1.3):
    n = int(d * SR)
    t = np.linspace(0, 1, n)
    roar = bandpass(rng.standard_normal(n), lo=40, hi=1400) * (0.3 + .7 * t)
    whine = tone(n, 1800 * (1 + t * .8), ((1, .5), (1.5, .3)))
    x = (roar * .8 + whine * .25) * env(n, .15, .35)
    p = np.linspace(-.5, .6, n)
    return np.vstack([x * (1 - p) / 1.4, x * (1 + p) / 1.4])


def scratch(d=0.32):
    n = int(d * SR)
    t = np.linspace(0, 1, n)
    f = 300 + 1500 * np.abs(np.sin(t * np.pi * 2.5))
    x = (bandpass(rng.standard_normal(n), lo=300, hi=4000) * .6 + tone(n, f) * .4) * env(n, .005, .08)
    return x


def sting():
    d = 2.2
    n = int(d * SR)
    out = np.zeros(n)
    for f in (261.63, 329.63, 392.0, 523.25):
        out += tone(n, f, ((1, 1), (2, .35), (3, .12)), 1.8)
    sub = tone(n, 65.4) * np.exp(-np.arange(n) / SR * 2.5) * 1.2
    x = reverb((out * .25 + sub) * env(n, .006, .6), 2.2, .35) * env(n, .002, .3)
    return stereo(x / (np.max(np.abs(x)) + 1e-9))


# ---------------------------------------------------------------- music
NOTE = {'A': 220.0, 'B': 246.94, 'C': 261.63, 'D': 293.66, 'E': 329.63, 'F': 174.61, 'G': 196.0}
MINOR = [('A', 'ACE'), ('F', 'FAC'), ('C', 'CEG'), ('G', 'GBD')]
MAJOR = [('F', 'FAC'), ('C', 'CEG'), ('G', 'GBD'), ('A', 'ACE')]
BPM = 104
BEAT = 60 / BPM
BAR = BEAT * 4


def section(t0, t1, prog=MINOR, pad=.06, bass=.3, kick=.5, arp=.05, shaker=0.0, lp=None, bar_offset=0):
    n0, n1 = int(t0 * SR), int(t1 * SR)
    n = n1 - n0
    out = np.zeros(n)
    t = np.arange(n) / SR + t0
    # grid-aligned bars over the whole song so sections stay in time
    first_bar = int(np.floor(t0 / BAR))
    b = first_bar
    while b * BAR < t1:
        root, tones = prog[(b + bar_offset) % len(prog)]
        bs = b * BAR
        # pad
        s, e = max(n0, int(bs * SR)), min(n1, int((bs + BAR + .3) * SR))
        if e > s:
            tt = np.arange(e - s) / SR + (s / SR - bs)
            ev = env(e - s, .35, .4)
            for name in tones:
                f = NOTE[name] * (2 if NOTE[name] < 200 else 1)
                for det in (-.004, 0, .004):
                    for h in range(1, 6):
                        out[s - n0:e - n0] += pad * ev * np.sin(2 * np.pi * f * (1 + det) * h * tt + h) * (.5 / h) * np.exp(-h * .3)
        for k in range(4):
            ks = bs + k * BEAT
            if ks + BEAT < t0 or ks >= t1:
                continue
            s, e = max(n0, int(ks * SR)), min(n1, int((ks + BEAT) * SR))
            if e <= s:
                continue
            off = s / SR - ks
            tt = np.arange(e - s) / SR + off
            f = NOTE[root] / 4
            be = env(e - s, .012 if off == 0 else .002, .05) * np.exp(-tt * 2.5)
            out[s - n0:e - n0] += bass * be * (np.sin(2 * np.pi * f * tt) + .25 * np.sin(4 * np.pi * f * tt))
            if kick and k in (0, 2) and off == 0:
                ke = min(n1, s + int(.4 * SR))
                kt = np.arange(ke - s) / SR
                fr = 45 + 70 * np.exp(-kt * 28)
                out[s - n0:ke - n0] += kick * env(ke - s, .004, .08) * np.exp(-kt * 9) * np.sin(2 * np.pi * np.cumsum(fr) / SR)
            if shaker:
                for half in (0, .5):
                    hs = int((ks + half * BEAT) * SR)
                    if n0 <= hs and hs + int(.09 * SR) < n1:
                        m = int(.09 * SR)
                        sh = bandpass(rng.standard_normal(m), lo=6000, hi=12000) * env(m, .008, .06) * np.exp(-np.arange(m) / SR * 30)
                        out[hs - n0:hs - n0 + m] += shaker * sh * (1 if half else .6)
            if arp:
                seq = list(tones) + [tones[1]]
                for half in (0, .5):
                    hs = ks + half * BEAT
                    s2, e2 = int(hs * SR), int((hs + .4) * SR)
                    if s2 < n0 or e2 > n1:
                        continue
                    tt2 = np.arange(e2 - s2) / SR
                    f = NOTE[seq[(k * 2 + int(half * 2)) % len(seq)]] * 2
                    out[s2 - n0:e2 - n0] += arp * env(e2 - s2, .006, .08) * np.exp(-tt2 * 8) * (np.sin(2 * np.pi * f * tt2) + .2 * np.sin(4 * np.pi * f * tt2))
        b += 1
    pump = .75 + .25 * np.sin(np.pi * ((t % BEAT) / BEAT)) ** 2
    out *= pump
    if lp:
        out = bandpass(out, hi=lp)
    return out


def tape_stop(x, start, dur):
    """Slow the music down to a halt (pitch drops) over [start, start+dur]."""
    s, n = int(start * SR), int(dur * SR)
    seg = x[s:s + n * 2].copy()
    speed = np.linspace(1, 0, n) ** 1.3
    pos = np.cumsum(speed)
    idx = np.clip(pos.astype(int), 0, len(seg) - 2)
    frac = pos - idx
    y = seg[idx] * (1 - frac) + seg[idx + 1] * frac
    fade = np.ones(n); r = int(.12 * SR); fade[-r:] = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, r))
    x[s:s + n] = y * fade
    x[s + n:] = 0
    return x


def build_music():
    tSlow = W('тормозит')
    tStop = W('выбрасывайте') - .1
    tRew = tStop + .62
    tEasy = W('Легко')
    tDeal = W('договорились')
    parts = []
    def add(t0, t1, fade=.12, **kw):
        y = section(t0, t1, **kw)
        n = len(y)
        y *= env(n, fade, fade)
        parts.append((t0, y))
    # intro: airy, then groove after the whip-zoom
    add(0, 2.1, fade=.6, pad=.07, bass=0, kick=0, arp=.03, lp=2500)
    add(2.0, T['plane'][0] + .05, pad=.06, bass=.3, kick=.45, arp=.045)
    add(T['plane'][0], tSlow + .2, pad=.06, bass=.32, kick=.55, arp=.05, shaker=.04)
    # frozen-laptop: muffled, sad loop
    add(tSlow - .1, T['dust'][0] + .05, pad=.05, bass=.15, kick=.2, arp=.0, lp=700)
    add(T['dust'][0], T['ssd'][0] + .05, pad=.055, bass=.28, kick=.45, arp=.04)
    add(T['ssd'][0], T['price'][0] + .05, pad=.06, bass=.32, kick=.5, arp=.055, shaker=.03)
    add(T['price'][0], T['gaming'][0] + .05, prog=MAJOR, pad=.06, bass=.22, kick=.3, arp=.04, lp=4500)
    add(T['gaming'][0], tEasy + .02, pad=.06, bass=.3, kick=.5, arp=.05, lp=3000)
    add(tEasy, T['remote'][0] + .05, pad=.07, bass=.38, kick=.65, arp=.07, shaker=.06)
    add(T['remote'][0], tStop + .02, prog=MAJOR, pad=.06, bass=.28, kick=.45, arp=.05, fade=.03)
    add(tRew + .55, TOTAL, prog=MAJOR, pad=.07, bass=.3, kick=.5, arp=.055, fade=.15)
    out = np.zeros(N)
    for t0, y in parts:
        s = int(t0 * SR)
        e = min(N, s + len(y))
        out[s:e] += y[:e - s]
    # tape-stop exactly as the screen freezes, then the muffled loop takes over
    seg_start = tSlow - .5
    s = int(seg_start * SR)
    keep = out[int((tSlow + .2) * SR):].copy()
    out = tape_stop(out, seg_start, .5)
    out[int((tSlow + .2) * SR):] = keep
    # hard silence while the freeze-frame holds
    a, b = int(tStop * SR), int((tRew + .55) * SR)
    g = np.ones(N); f = int(.015 * SR)
    g[a:b] = 0; g[a - f:a] = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, f)); g[b:b + f] = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, f))
    out *= g
    out = reverb(out, 1.5, .2)
    out = np.tanh(out * 1.3) / 1.3
    out *= env(N, .3, 1.4)
    out /= np.max(np.abs(out)) + 1e-9
    right = np.concatenate([np.zeros(240), out[:-240]])
    return np.vstack([out, right]) * .85


def build_sfx():
    sfx = np.zeros((2, N))
    # 1. intro
    place(sfx, whoosh(.5, 400, 5000), 1.68, .35)
    place(sfx, impact(1.2), 2.08, .45)
    place(sfx, chime([1046.5, 1568.0], 1.2, .08, 4.5), 2.35, .12)
    # 2. plane
    tNoise, tPlane, tSlow = W('ШУМИТ'), W('самолёт'), W('тормозит')
    tTurbIn = tPlane - .12
    place(sfx, stereo(fan_whine(tTurbIn - tNoise + .3)), tNoise - .3, .32)
    place(sfx, impact(1.0, bright=True), tNoise - .02, .35)
    place(sfx, jet(tSlow - tTurbIn + .2), tTurbIn - .05, .38)
    place(sfx, chime([1318.5, 1046.5], 1.1, .32, 3.0), tTurbIn + .15, .18)  # "ding-dong" cabin chime
    for k in range(3):
        place(sfx, stereo(tick(1500 if k % 2 else 1100, .06)), tSlow + .25 + k * .9, .12)
    place(sfx, stereo(blip(500, .2)), tSlow + 1.35, .2)
    # 3. dust
    A3 = T['dust'][0]
    tDust, tPaste, tHour, tNew = W('пыль'), W('термопаста'), W('Час'), W('новый')
    place(sfx, whoosh(.9, 300, 1500, False), A3 + .1, .12)
    for i, tc in enumerate([tDust - 1.0, tDust - .5, tDust]):
        place(sfx, stereo(blip(900 + i * 150, .1)), tc, .22)
    for k in range(2):
        place(sfx, stereo(blip(1600, .12)), tPaste + .35 + k * .16, .2)
    for k in range(3):
        place(sfx, stereo(swish(.2)), tHour + k * .22, .25)
    place(sfx, whoosh(.5, 600, 3000), tHour + .8, .18)
    place(sfx, chime([783.99, 1046.5, 1318.5], 1.6, .07, 2.8), tNew - .05, .22)
    # 4. ssd
    tSSD, tFast = W('Поставил'), W('секунды')
    place(sfx, riser(1.0), tSSD - .9, .25)
    place(sfx, whoosh(.45, 800, 3000), tSSD - .05, .3)
    place(sfx, impact(1.4, bright=True), tSSD + .33, .5)
    n = int(.6 * SR)
    place(sfx, stereo(tone(n, np.linspace(300, 1600, n), ((1, 1), (2, .3))) * env(n, .02, .2) * .5), tSSD + .4, .2)
    place(sfx, chime([1567.98], .8, 0, 6), tFast, .15)
    # 5. price
    A5 = T['price'][0]
    tAlways, tAdv, tNo = W('всегда', A5), W('заранее', A5), W('Никаких')
    place(sfx, stereo(pop()), A5 + .2, .3)
    place(sfx, stereo(pop()), tAlways + .25, .3)
    place(sfx, impact(.9), tAdv - .05, .4)
    place(sfx, stereo(swish(.18)), tAdv + .25, .35)
    place(sfx, stereo(swish(.18)), tAdv + .38, .35)
    place(sfx, chime([1046.5, 1318.5], 1.0, .06, 4), tNo, .2)
    # 6. languages
    for g in cfg['greetings']:
        place(sfx, stereo(pop(.14)), W(g[2]) - .05, .32)
    place(sfx, whoosh(.4, 500, 2500), W('как', W('по-польски')) - .1, .15)
    # 7. gaming
    tStart, tEasy = W('Собрать'), W('Легко')
    for dt in (.05, .45, .75, .9, 1.15):
        place(sfx, stereo(thunk()), tStart + dt + .3, .35)
    place(sfx, riser(.6, 600, 5000), tEasy - .55, .2)
    place(sfx, impact(1.6), tEasy - .02, .55)
    # 8. remote
    A8 = T['remote'][0]
    for k in range(6):
        place(sfx, stereo(blip(1400 + (k % 3) * 200, .07)), A8 + .3 + k * .4, .1)
    place(sfx, chime([1174.66, 1567.98], .9, .06, 5), W('Тоже'), .16)
    # 9. trash
    tStop = W('выбрасывайте') - .1
    tRew = tStop + .62
    place(sfx, whoosh(.8, 200, 1200), T['trash'][0] + .3, .2)
    place(sfx, stereo(scratch()), tStop - .02, .45)
    place(sfx, impact(.8), tStop, .3)
    n = int(.55 * SR)
    rw = glide_noise(n, 4000, 300) * env(n, .02, .05) * .6 + tone(n, np.linspace(1400, 300, n)) * env(n, .02, .05) * .2
    place(sfx, stereo(rw), tRew, .3)
    # 10. final
    tTg, tSer, tDeal = W('Телеграм'), W('Серьёзно'), W('договорились')
    place(sfx, whoosh(.6, 300, 2500), T['final'][0] - .2, .2)
    place(sfx, stereo(pop(.16)), tTg - .1, .35)
    for i in range(len(cfg['services'])):
        place(sfx, stereo(blip(1000 + i * 120, .06)), tSer - .2 + i * .17, .08)
    place(sfx, stereo(blip(700, .18)), tDeal - .1, .25)
    place(sfx, sting(), tDeal + .9, .55)
    return sfx


def write(path, st):
    st = np.clip(st, -1, 1)
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((st * 32767).astype('<i2').T.copy().tobytes())


if __name__ == '__main__':
    out = HERE / 'build'
    out.mkdir(exist_ok=True)
    write(out / 'music.wav', build_music())
    write(out / 'sfx.wav', build_sfx())
    print(f'music.wav + sfx.wav ({TOTAL:.2f}s)')
