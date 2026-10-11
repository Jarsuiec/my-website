"""Synthesized soundtrack + SFX + voice mix. numpy only."""
import json, sys, wave
import numpy as np

D = sys.argv[1]
SR = 48000
cfg = json.load(open(f'{D}/sfx.json'))
END = cfg['end']; EV = cfg['ev']
tim = json.load(open(f'{D}/timing.json'))
S = tim['sentences']
N = int((END + 0.2) * SR)
rs = np.random.RandomState(7)

BPM = 120.0; BEAT = 60 / BPM; BAR = 4 * BEAT
O = S[9]['s'] - 14 * BAR          # drop (sentence 9) lands on bar 14
DROP1 = O + 14 * BAR              # ~29.26
DROP2 = O + 30 * BAR              # ~61.26
FINAL = S[19]['words'][1]['s'] - 0.01
STOP_A = S[3]['s'] - 0.05         # "а заказов почти нет" -> music stops
STOP_B = O + 7 * BAR              # comes back
BREAK_A = O + 26 * BAR            # breakdown "не обещаю"
BUILD2 = O + 29 * BAR
KNOW = S[8]['s'] - 0.05           # "И знаете что?" gap

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def tt(n): return np.arange(n) / SR
def stereo(x, pan=0.0):
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    return np.stack([x * l * 1.414, x * r * 1.414], 1)
def place(buf, sig, t, g=1.0):
    i = int(round(t * SR))
    if sig.ndim == 1: sig = stereo(sig)
    if i < 0: sig = sig[-i:]; i = 0
    n = min(len(sig), len(buf) - i)
    if n > 0: buf[i:i + n] += sig[:n] * g

def fft_filter(x, lo=None, hi=None, order=2):
    n = len(x); X = np.fft.rfft(x, axis=0); f = np.fft.rfftfreq(n, 1 / SR); H = np.ones_like(f)
    if hi: H *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if lo: H *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    if x.ndim == 2: H = H[:, None]
    return np.fft.irfft(X * H, n, axis=0)

def tv_lowpass(x, fc_of_t, block=2048):
    """time-varying lowpass via overlapped FFT blocks (hann, 50% overlap)."""
    hop = block // 2; win = np.hanning(block + 1)[:-1]
    out = np.zeros_like(x); f = np.fft.rfftfreq(block, 1 / SR)
    for i in range(0, len(x) - block, hop):
        fc = fc_of_t((i + hop) / SR)
        H = (1 / np.sqrt(1 + (f / fc) ** 4))[:, None]
        seg = x[i:i + block] * win[:, None]
        out[i:i + block] += np.fft.irfft(np.fft.rfft(seg, axis=0) * H, block, axis=0)
    return out

def saw(freq, n, ph=0.0):
    p = (ph + np.cumsum(np.full(n, freq) if np.isscalar(freq) else freq) / SR) % 1.0
    return 2 * p - 1

def env(n, a=0.005, r=0.05, hold=None):
    e = np.ones(n); na = max(1, int(a * SR)); nr = max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    if nr < n: e[-nr:] *= np.linspace(1, 0, nr)
    return e

# ------------------------------------------------------------- one-shots
def kick():
    n = int(.55 * SR); t = tt(n)
    f = 46 + 120 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 6.5) * np.minimum(1, t * 800)
    click = rs.randn(n) * np.exp(-t * 400) * .25
    return np.tanh((body + click) * 1.6) * .9
def clap():
    n = int(.4 * SR); t = tt(n); x = np.zeros(n); nz = rs.randn(n)
    for d in (0, .011, .022): m = t >= d; x[m] += nz[m] * np.exp(-(t[m] - d) * 120)
    x += nz * np.exp(-t * 16) * .35
    return fft_filter(x, lo=900, hi=5000) * 1.2
def hat(open_=False):
    n = int((.35 if open_ else .07) * SR); t = tt(n)
    return fft_filter(rs.randn(n), lo=7500) * np.exp(-t * (11 if open_ else 70)) * .45
def snare():
    n = int(.25 * SR); t = tt(n)
    x = fft_filter(rs.randn(n), lo=400, hi=9000) * np.exp(-t * 22) + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 35) * .5
    return x * .6
def pluck(m, dur=.45, bright=1.0):
    n = int(dur * SR); t = tt(n); f = mtof(m); x = np.zeros(n)
    for k in range(1, 14):
        if f * k > 15000: break
        x += np.sin(2 * np.pi * f * k * t) / k * np.exp(-t * (4 + k * 2.6 / bright))
    return x * np.minimum(1, t * 400) * .35
def boom(k=1.0):
    n = int(2.6 * SR); t = tt(n)
    f = 30 + 70 * np.exp(-t * 9)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    nz = fft_filter(rs.randn(n), hi=1800) * np.exp(-t * 7) * .6
    crack = fft_filter(rs.randn(n), lo=2500) * np.exp(-t * 30) * .35
    return np.tanh((sub + nz + crack) * 1.4) * k
def whoosh(dur=.55, k=1.0):
    n = int(dur * SR); t = tt(n); u = t / dur
    nz = np.stack([rs.randn(n), rs.randn(n)], 1)
    out = tv_lowpass(nz, lambda s: 400 + 9000 * np.sin(np.pi * min(1, s / dur)) ** 2, 1024)
    amp = np.sin(np.pi * u) ** 2
    pan = np.stack([1 - u * .8, .2 + u * .8], 1)
    return fft_filter(out, lo=250) * amp[:, None] * pan * .55 * k
def pop():
    n = int(.18 * SR); t = tt(n)
    f = 1500 * np.exp(-t * 18) + 600
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30) * .5
def riser(dur, k=1.0):
    n = int(dur * SR); t = tt(n); u = t / dur
    nz = np.stack([rs.randn(n), rs.randn(n)], 1)
    x = tv_lowpass(nz, lambda s: 300 + 11000 * (s / dur) ** 2.2)
    sw = np.sin(2 * np.pi * np.cumsum(200 + 1400 * u ** 2) / SR)
    a = u ** 2.2
    return (fft_filter(x, lo=200) * .5 + stereo(sw * .18)) * a[:, None] * k

def reverb_ir(sec=2.4, decay=2.6):
    n = int(sec * SR); t = tt(n)
    ir = np.stack([rs.randn(n), rs.randn(n)], 1) * np.exp(-t * decay)[:, None]
    ir = fft_filter(ir, lo=200, hi=6500); ir[:int(.012 * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum()) * .9
def convolve(x, ir):
    n = len(x) + len(ir); nf = 1 << (n - 1).bit_length()
    X = np.fft.rfft(x, nf, axis=0); I = np.fft.rfft(ir, nf, axis=0)
    return np.fft.irfft(X * I, nf, axis=0)[:len(x)]

# ------------------------------------------------------------- arrangement
CH = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]]   # Am F C G
ROOT = [45, 41, 48, 43]
nbars = int((END - O) / BAR) + 2
drums = np.zeros((N, 2)); bass = np.zeros((N, 2)); chords = np.zeros((N, 2)); pad = np.zeros((N, 2)); arp = np.zeros((N, 2)); fx = np.zeros((N, 2))
K, CL, HC, HO, SN = kick(), clap(), hat(), hat(True), snare()

def sec(t):
    if t < 0: return 'pre'
    if STOP_A <= t < STOP_B: return 'stop'
    if t < STOP_A: return 'intro'
    if t < KNOW: return 'verse'
    if t < DROP1: return 'gap'
    if t < BREAK_A: return 'drop'
    if t < BUILD2: return 'break'
    if t < DROP2: return 'build'
    if t < FINAL: return 'drop'
    return 'end'

for b in range(-1, nbars):
    t0 = O + b * BAR; ci = b % 4
    for beat in range(4):
        for sub in range(4):
            t = t0 + beat * BEAT + sub * BEAT / 4
            if t < 0 or t >= END: continue
            s = sec(t); step = beat * 4 + sub
            if s == 'intro':
                if sub == 0 and t > O + 2 * BAR: place(drums, K, t, .55)
                if sub == 2 and t > O + 1 * BAR: place(drums, HC, t, .35)
                place(arp, pluck(CH[ci][(step * 3) % 4] + 12, .4, .8), t, .5 if sub % 2 == 0 else .3)
            elif s == 'verse':
                if sub == 0 and t > STOP_B + BAR: place(drums, K, t, .8)
                if sub == 0 and beat in (1, 3) and t > O + 10 * BAR: place(drums, CL, t, .55)
                if sub == 2: place(drums, HC, t, .4)
                place(arp, pluck(CH[ci][(step * 3) % 4] + 12, .4, 1.0), t, .55 if sub % 2 == 0 else .35)
                if t > O + 12 * BAR:  # snare roll build
                    u = (t - (O + 12 * BAR)) / (KNOW - (O + 12 * BAR))
                    if u < 1 and (sub % 2 == 0 or u > .5): place(drums, SN, t, .15 + .5 * u)
            elif s in ('drop',):
                if sub == 0: place(drums, K, t, 1.0)
                if sub == 0 and beat in (1, 3): place(drums, CL, t, .8)
                if sub == 2: place(drums, HO, t, .45)
                if sub in (1, 3): place(drums, HC, t, .25)
                m = CH[ci][[0, 1, 2, 3, 2, 1, 3, 2][step % 8]] + 24
                place(arp, pluck(m, .3, 1.6), t, .4)
                place(arp, pluck(m, .3, 1.6), t + 3 * BEAT / 4, .15)   # echo
            elif s == 'break':
                if sub == 0 and beat == 0: place(arp, pluck(CH[ci][0] + 12, 1.2, .6), t, .5)
                if sub == 0 and beat == 2: place(arp, pluck(CH[ci][2] + 12, 1.2, .6), t, .35)
            elif s == 'build':
                u = (t - BUILD2) / (DROP2 - BUILD2)
                if sub == 0: place(drums, K, t, .5 + .4 * u)
                if sub % 2 == 0 or u > .5: place(drums, SN, t, .2 + .6 * u)
                place(arp, pluck(CH[ci][step % 4] + 24, .3, 1.2), t, .3 + .2 * u)
    # chord / pad / bass per bar
    if t0 + BAR < 0 or t0 >= END: continue
    n = int(BAR * SR); tb = tt(n)
    for half in range(2 if True else 1):
        pass
    s_mid = sec(t0 + BAR / 2)
    pad_on = s_mid in ('intro', 'verse', 'break', 'build', 'gap', 'stop', 'pre', 'drop')
    if pad_on:
        x = np.zeros((n, 2))
        for m in CH[ci]:
            for d, pn in ((-.08, -.7), (.08, .7), (0, 0)):
                x += stereo(saw(mtof(m + d), n, rs.rand()), pn) * .06
        x = x * env(n, .35, .4)[:, None]
        place(pad, x, t0)
    if s_mid in ('drop', 'build'):
        x = np.zeros((n, 2))
        for m in CH[ci] + [CH[ci][0] + 12]:
            for j in range(5):
                d = (j - 2) * .07
                x += stereo(saw(mtof(m + 12 + d), n, rs.rand()), (j - 2) / 2) * .045
        place(chords, x * env(n, .01, .2)[:, None], t0, .8 if s_mid == 'drop' else .35)
    if s_mid in ('verse', 'drop', 'build', 'break') and not (s_mid == 'verse' and t0 < O + 10 * BAR):
        f = mtof(ROOT[ci]); x = saw(f, n) * .5 + np.sin(2 * np.pi * f / 2 * tb) * .8
        for j in range(8):  # 8th-note bass gate
            if s_mid in ('break',) and j % 4: continue
            pass
        place(bass, x * env(n, .01, .1), t0, .7 if s_mid != 'break' else .4)

# sidechain pumping (drops)
tv = np.arange(N) / SR
ph = ((tv - O) % BEAT) / BEAT
pump = 1 - .75 * np.clip(1 - ph / .45, 0, 1) ** 2
issec = np.vectorize(sec)(tv[::480]); drop_mask = np.repeat(np.isin(issec, ['drop', 'build']).astype(float), 480)[:N]
drop_mask = np.convolve(drop_mask, np.ones(2400) / 2400, 'same')
pumpg = (1 - drop_mask) + drop_mask * pump
bass = fft_filter(bass, hi=420, order=3) * pumpg[:, None]
chords = tv_lowpass(chords, lambda t: 1500 + 7000 * np.clip((t - BUILD2) / (DROP2 - BUILD2), 0, 1) if BUILD2 <= t < DROP2 else 6500) * pumpg[:, None]
pad = fft_filter(pad, hi=1600, order=2) * (1 - .5 * drop_mask * (1 - pump))[:, None]
arp = fft_filter(arp, lo=180)

# verse filter: build opens the pad/arp; stop section = silence of harmonic parts
def section_gain(t):
    if STOP_A + .25 <= t < STOP_B - .05: return 0.0
    if KNOW + .1 <= t < DROP1: return 0.0
    if t >= FINAL: return 0.0
    return 1.0
g = np.array([section_gain(x) for x in tv[::240]]); g = np.repeat(g, 240)[:N]
g = np.convolve(g, np.ones(1200) / 1200, 'same')  # 25ms smoothing
# tape-stop style dip into "а заказов почти нет"
music = (drums * 1.0 + bass * 1.0 + chords * .9 + pad * 1.1 + arp * .9)
dip = np.clip((tv - (STOP_A - .3)) / .3, 0, 1) * (tv < STOP_B)
music = tv_lowpass(music, lambda t: 18000 if t < STOP_A - .3 or t >= STOP_B else max(150, 18000 * (1 - (t - STOP_A + .3) / .55) ** 3))
music *= g[:, None]

# drone during stop + end pad
dr = np.zeros((N, 2))
n = int((STOP_B - STOP_A + .4) * SR); t = tt(n)
x = (np.sin(2 * np.pi * 55 * t) * .5 + np.sin(2 * np.pi * 82.4 * t) * .2) * env(n, .3, .4)
place(dr, x, STOP_A + .1, .5)
n = int((END - FINAL + .5) * SR); t = tt(n); x = np.zeros((n, 2))
for m in [45, 57, 60, 64, 69, 72, 76]:
    for d, pn in ((-.06, -.8), (.06, .8)):
        x += stereo(saw(mtof(m + d), n, rs.rand()), pn) * .05
x = fft_filter(x, hi=2500) * (env(n, .02, 2.2) * np.exp(-t * .35))[:, None]
place(dr, x, FINAL + .02, 1.0)
music += dr

# ------------------------------------------------------------- SFX
for e in EV:
    t, k, ty = e['t'], e['k'], e['type']
    if ty == 'impact': place(fx, boom(min(1.2, .5 + k * .5)), t, .75 * min(1.3, .4 + k * .6))
    elif ty == 'whoosh': place(fx, whoosh(.5, 1), t - .1, .55 * k)
    elif ty == 'warp': place(fx, whoosh(.8, 1), t - .35, .5 * min(1.4, k))
    elif ty == 'pop': place(fx, pop(), t, .5 * k)
    elif ty == 'riser': place(fx, riser(e['d'], 1), t, .6 * k)

# reverse swell into DROP1 (from reverb of the drop chord)
n = int(1.2 * SR)
sw = np.zeros((n, 2))
for m in CH[0]: sw += stereo(saw(mtof(m + 12), n), 0) * .06
sw = convolve(fft_filter(sw * env(n, .005, .3)[:, None], hi=5000), reverb_ir(2.0, 2))[::-1]
place(fx, sw * np.linspace(0, 1, n)[:, None] ** 2, DROP1 - 1.2, .6)
place(fx, sw * np.linspace(0, 1, n)[:, None] ** 2, FINAL - 1.2, .4)

# reverb send
IR = reverb_ir()
wet = convolve(pad * .5 + arp * .6 + chords * .25 + fx * .35 + dr * .4, IR)
music = music + wet * .45
fxdry = fx

# ------------------------------------------------------------- voice + ducking
with wave.open(f'{D}/voice.wav') as w:
    v = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
voice = np.zeros(N); voice[:min(N, len(v))] = v[:N]
voice = voice / (np.abs(voice).max() + 1e-9) * .89
# envelope follower
a = np.abs(voice); blk = 480
envv = np.array([a[i:i + blk].max() for i in range(0, N, blk)])
sm = np.zeros_like(envv); cur = 0
for i, x in enumerate(envv):
    cur = x if x > cur else cur * .93
    sm[i] = cur
sm = np.repeat(sm, blk)[:N]
duck = 1 - .45 * np.clip(sm / .3, 0, 1)
# sfx sit a little under the voice too
music = fft_filter(music, lo=28, hi=14000, order=2)
mus_rms = np.sqrt(np.mean(music ** 2)) + 1e-9
music = music / mus_rms * .085
fxdry_part = 0  # fx already inside music
mix = music * duck[:, None] + stereo(voice, 0) * .78
# simple bus glue: soft clip
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
fo = int(.6 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = mix / (np.abs(mix).max() + 1e-9) * .97
with wave.open(f'{D}/mix.wav', 'w') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
music_only = music / (np.abs(music).max() + 1e-9) * .9
with wave.open(f'{D}/music.wav', 'w') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((music_only * 32767).astype(np.int16).tobytes())
print('ok', N / SR, 'drop1', DROP1, 'drop2', DROP2, 'final', FINAL)
