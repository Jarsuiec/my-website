"""Generates a music bed and sound effects for a reel, timed from its video.json.

Every envelope starts and ends at zero amplitude, so nothing clicks.
Usage: python3 reels/engine/audio.py reels/videos/01-noutbuk-greetsya
Writes music.wav and sfx.wav next to video.json.
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np

SR = 48000
rng = np.random.default_rng(7)


def write_wav(path, stereo):
    stereo = np.clip(stereo, -1, 1)
    data = (stereo * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.T.copy().tobytes())


def smooth_env(n, attack, release):
    """Envelope 0 -> 1 -> 0 with raised-cosine ramps (no discontinuities)."""
    env = np.ones(n)
    a, r = max(1, int(attack * SR)), max(1, int(release * SR))
    a, r = min(a, n // 2), min(r, n // 2)
    env[:a] = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, a))
    env[n - r:] = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, r))
    return env


def fft_filter(x, lo=None, hi=None):
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    mask = np.ones_like(f)
    if lo:
        mask *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        mask *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(spec * mask, len(x))


def reverb(x, seconds=1.8, mix=0.25):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * 3.2)
    ir = fft_filter(ir, hi=6000)
    ir /= np.sqrt(np.sum(ir ** 2))
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x)]
    return x * (1 - mix) + wet * mix


def moving_band_noise(n, f_from, f_to, width=0.6):
    """White noise through a band-pass whose centre glides f_from -> f_to (overlap-add)."""
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    hop = 1024
    win = np.hanning(hop * 2)
    for start in range(0, n, hop):
        seg = noise[start:start + hop * 2]
        if len(seg) < hop * 2:
            seg = np.pad(seg, (0, hop * 2 - len(seg)))
        k = start / max(1, n)
        fc = f_from * (f_to / f_from) ** k
        filt = fft_filter(seg * win, lo=fc * (1 - width / 2), hi=fc * (1 + width))
        end = min(n, start + hop * 2)
        out[start:end] += filt[:end - start]
    return out / (np.max(np.abs(out)) + 1e-9)


# ---------------- music ----------------
NOTE = {'A': 220.0, 'C': 261.63, 'D': 293.66, 'E': 329.63, 'F': 174.61, 'G': 196.0, 'B': 246.94}
CHORDS = [('A', ['A', 'C', 'E']), ('F', ['F', 'A', 'C']), ('C', ['C', 'E', 'G']), ('G', ['G', 'B', 'D'])]


def music(total, bpm=100):
    n = int(total * SR)
    t = np.arange(n) / SR
    beat = 60 / bpm
    bar = beat * 4
    pad = np.zeros(n)
    bass = np.zeros(n)
    arp = np.zeros(n)
    kick = np.zeros(n)

    bar_idx = 0
    t0 = 0.0
    while t0 < total:
        root, tones = CHORDS[bar_idx % len(CHORDS)]
        s, e = int(t0 * SR), min(n, int((t0 + bar + 0.35) * SR))
        seg_t = t[s:e] - t0
        env = smooth_env(e - s, 0.45, 0.5)
        # pad: detuned soft saws (few harmonics) one octave up
        for name in tones:
            f = NOTE[name] * 2 if NOTE[name] < 200 else NOTE[name]
            for det in (-0.004, 0, 0.004):
                for h in range(1, 6):
                    pad[s:e] += env * np.sin(2 * np.pi * f * (1 + det) * h * seg_t + h) * (0.5 / h) * np.exp(-h * 0.3)
        # bass on every beat, smooth attack/release
        for b in range(4):
            bs = t0 + b * beat
            s2, e2 = int(bs * SR), min(n, int((bs + beat) * SR))
            if s2 >= n:
                break
            bt = t[s2:e2] - bs
            f = NOTE[root] / 4
            benv = smooth_env(e2 - s2, 0.012, 0.05) * np.exp(-bt * 2.5)
            bass[s2:e2] += benv * (np.sin(2 * np.pi * f * bt) + 0.25 * np.sin(4 * np.pi * f * bt))
            if b in (0, 2):  # soft kick: pitch glide, phase-continuous, smooth 4 ms attack
                ke = min(n, s2 + int(0.4 * SR))
                kt = t[s2:ke] - bs
                freq = 45 + 70 * np.exp(-kt * 28)
                phase = 2 * np.pi * np.cumsum(freq) / SR
                kick[s2:ke] += smooth_env(ke - s2, 0.004, 0.08) * np.exp(-kt * 9) * np.sin(phase)
        # arp: 8th-note plucks over chord tones, two octaves up
        seq = tones + [tones[1]]
        for k in range(8):
            ns = t0 + k * beat / 2
            s3, e3 = int(ns * SR), min(n, int((ns + 0.45) * SR))
            if s3 >= n:
                break
            nt = t[s3:e3] - ns
            f = NOTE[seq[k % len(seq)]] * 2
            arp[s3:e3] += smooth_env(e3 - s3, 0.006, 0.08) * np.exp(-nt * 8) * (np.sin(2 * np.pi * f * nt) + 0.2 * np.sin(4 * np.pi * f * nt))
        t0 += bar
        bar_idx += 1

    # gentle pump on the pad (continuous, no gain jumps)
    pump = 0.72 + 0.28 * np.sin(np.pi * ((t % beat) / beat)) ** 2
    pad *= pump
    # echo on arp
    d = int(beat * 0.75 * SR)
    for i, g in enumerate((0.4, 0.2, 0.1), 1):
        arp[d * i:] += arp[:-d * i] * g if d * i < n else 0

    mix = 0.06 * pad + 0.33 * bass + 0.05 * arp + 0.55 * kick
    mix = reverb(mix, 1.6, 0.22)
    mix = np.tanh(mix * 1.4) / 1.4
    mix *= smooth_env(n, 0.8, 1.6)
    mix /= np.max(np.abs(mix)) + 1e-9
    # light stereo width: delay one side a little
    right = np.concatenate([np.zeros(240), mix[:-240]])
    return np.vstack([mix, right]) * 0.85


# ---------------- sfx ----------------
def whoosh(dur=0.5, rising=False):
    n = int(dur * SR)
    x = moving_band_noise(n, 300 if not rising else 400, 4000 if not rising else 7000)
    if rising:
        env = (np.linspace(0, 1, n) ** 2.2) * smooth_env(n, 0.01, 0.04)
    else:
        env = np.sin(np.linspace(0, np.pi, n)) ** 2
    x *= env
    pan = np.linspace(-0.8, 0.8, n)
    return np.vstack([x * (1 - pan) / 2, x * (1 + pan) / 2])


def impact(dur=1.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    freq = 38 + 50 * np.exp(-t * 7)
    sub = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 3.5)
    body = fft_filter(rng.standard_normal(n), lo=60, hi=900) * np.exp(-t * 14) * 0.6
    x = (sub + body) * smooth_env(n, 0.003, 0.3)
    x = reverb(x, 1.4, 0.3)
    x /= np.max(np.abs(x)) + 1e-9
    return np.vstack([x, x])


def place(track, clip, at, gain):
    s = int(at * SR)
    if s < 0:
        clip = clip[:, -s:]
        s = 0
    e = min(track.shape[1], s + clip.shape[1])
    if e > s:
        track[:, s:e] += clip[:, :e - s] * gain


def main():
    vdir = Path(sys.argv[1])
    cfg = json.loads((vdir / 'video.json').read_text())
    scenes = cfg['scenes']
    total = scenes[-1]['t'][1]
    write_wav(vdir / 'music.wav', music(total))

    sfx = np.zeros((2, int(total * SR)))
    for i, s in enumerate(scenes):
        a = s['t'][0]
        if i and s.get('type') == 'cta':
            place(sfx, whoosh(1.1, rising=True), a - 1.05, 0.22)
            place(sfx, impact(), a, 0.45)
        elif i:
            place(sfx, whoosh(0.5), a - 0.25, 0.28)
        if s.get('big'):
            place(sfx, impact(), a + s['big'].get('at', 0.5), 0.6)
    write_wav(vdir / 'sfx.wav', sfx)
    print(f'music.wav + sfx.wav written ({total:.2f}s)')


if __name__ == '__main__':
    main()
