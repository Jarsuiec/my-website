"""Мини-синтезатор для музыки и саунд-дизайна PC MASTER.

Все звуки генерируются математически (без сэмплов и чужих записей), поэтому
трек и эффекты полностью оригинальные и свободны для коммерческого использования.
"""
import json
import os
import numpy as np
from scipy import signal

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_timeline():
    with open(os.path.join(ROOT, 'src', 'config', 'timeline.json'), encoding='utf-8') as f:
        tl = json.load(f)
    acc = 0.0
    starts = {}
    for s in tl['scenes']:
        starts[s['id']] = acc
        acc += s['dur']
    return tl, starts, acc


def cue(name, default=0.0):
    tl, _, _ = load_timeline()
    return tl.get('cues', {}).get(name, default)


def logo_drop():
    tl, _, _ = load_timeline()
    return tl.get('cues', {}).get('logoDrop', 1.5)


def buf(sec):
    return np.zeros((2, int(round(sec * SR))), dtype=np.float64)


def tt(n):
    return np.arange(n) / SR


def place(dst, src, at, gain=1.0, pan=0.0):
    """Кладёт моно/стерео сигнал src в dst с момента at (сек) с панорамой."""
    if src.ndim == 1:
        l = np.cos((pan + 1) * np.pi / 4)
        r = np.sin((pan + 1) * np.pi / 4)
        src = np.vstack([src * l * 1.4142, src * r * 1.4142])
    i0 = int(round(at * SR))
    if i0 >= dst.shape[1]:
        return
    s0 = 0
    if i0 < 0:
        s0 = -i0
        i0 = 0
    n = min(src.shape[1] - s0, dst.shape[1] - i0)
    if n > 0:
        dst[:, i0:i0 + n] += src[:, s0:s0 + n] * gain


# --- осцилляторы ---------------------------------------------------------------
def _polyblep(ph, dt):
    out = np.zeros_like(ph)
    m = ph < dt
    x = ph[m] / dt[m] if np.ndim(dt) else ph[m] / dt
    out[m] = x + x - x * x - 1
    m2 = ph > 1 - (dt if np.ndim(dt) == 0 else dt)
    if np.ndim(dt):
        x = (ph[m2] - 1) / dt[m2]
    else:
        x = (ph[m2] - 1) / dt
    out[m2] = x * x + x + x + 1
    return out


def phase(freq, n, ph0=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,))
    return (ph0 + np.cumsum(f) / SR) % 1.0, f / SR


def saw(freq, n, ph0=0.0):
    ph, dt = phase(freq, n, ph0)
    return 2 * ph - 1 - _polyblep(ph, dt)


def square(freq, n, ph0=0.0, pw=0.5):
    ph, dt = phase(freq, n, ph0)
    s = np.where(ph < pw, 1.0, -1.0)
    s += _polyblep(ph, dt)
    s -= _polyblep((ph + 1 - pw) % 1.0, dt)
    return s


def sine(freq, n, ph0=0.0):
    ph, _ = phase(freq, n, ph0)
    return np.sin(2 * np.pi * ph)


def noise(n, seed=0):
    return np.random.default_rng(seed).standard_normal(n)


# --- огибающие -----------------------------------------------------------------
def adsr(n, a=0.005, d=0.1, s=0.7, r=0.2, hold=None):
    """hold — длительность удержания до release (сек); по умолчанию — вся длина минус release."""
    t = tt(n)
    if hold is None:
        hold = max(0.0, n / SR - r)
    env = np.where(t < a, t / max(a, 1e-6), np.where(t < a + d, 1 - (1 - s) * (t - a) / max(d, 1e-6), s))
    rel = np.clip((t - hold) / max(r, 1e-6), 0, 1)
    return env * (1 - rel)


def expdec(n, tau):
    return np.exp(-tt(n) / tau)


# --- фильтры -------------------------------------------------------------------
def lp(x, fc, order=2):
    sos = signal.butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1)


def hp(x, fc, order=2):
    sos = signal.butter(order, min(fc, SR * 0.45), 'high', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1)


def bp(x, f1, f2, order=2):
    sos = signal.butter(order, [max(f1, 10), min(f2, SR * 0.45)], 'band', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1)


def sweep_lp(x, fc_curve, block=256, q=0.9):
    """Фильтр НЧ с меняющейся частотой среза (резонансный, 2-й порядок) — для «открытия» фильтра."""
    y = np.zeros_like(x)
    zi = np.zeros(2)
    fc_curve = np.broadcast_to(fc_curve, x.shape)
    for i in range(0, len(x), block):
        fc = float(np.clip(fc_curve[i], 30, SR * 0.45))
        w0 = 2 * np.pi * fc / SR
        alpha = np.sin(w0) / (2 * q)
        b = np.array([(1 - np.cos(w0)) / 2, 1 - np.cos(w0), (1 - np.cos(w0)) / 2])
        a = np.array([1 + alpha, -2 * np.cos(w0), 1 - alpha])
        seg, zi = signal.lfilter(b / a[0], a / a[0], x[i:i + block], zi=zi)
        y[i:i + block] = seg
    return y


# --- пространство ----------------------------------------------------------------
_IR = {}


def reverb_ir(sec=2.4, damp=5000, seed=1):
    key = (sec, damp, seed)
    if key not in _IR:
        n = int(sec * SR)
        t = tt(n)
        env = np.exp(-t * 6.9 / sec)
        l = lp(noise(n, seed) * env, damp)
        r = lp(noise(n, seed + 7) * env, damp)
        pre = int(0.012 * SR)
        ir = np.zeros((2, n + pre))
        ir[0, pre:] = l
        ir[1, pre:] = r
        ir /= np.sqrt(np.sum(ir ** 2) / 2)
        _IR[key] = ir
    return _IR[key]


def reverb(x, mix=0.3, sec=2.4, damp=5000):
    if x.ndim == 1:
        x = np.vstack([x, x])
    ir = reverb_ir(sec, damp)
    wet = np.vstack([signal.fftconvolve(x[0], ir[0])[: x.shape[1]], signal.fftconvolve(x[1], ir[1])[: x.shape[1]]])
    return x * (1 - mix) + wet * mix


def delay(x, sec, fb=0.35, mix=0.3, pingpong=True):
    if x.ndim == 1:
        x = np.vstack([x, x])
    d = int(sec * SR)
    out = x.copy()
    tap = x.copy()
    for k in range(1, 6):
        tap = tap * fb
        sh = np.zeros_like(x)
        if d * k < x.shape[1]:
            src = tap[::-1] if pingpong and k % 2 else tap
            sh[:, d * k:] = src[:, : x.shape[1] - d * k]
        out += sh * mix / fb
    return out


def note_hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def soft_clip(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)


def write_wav(path, x):
    from scipy.io import wavfile
    os.makedirs(os.path.dirname(path), exist_ok=True)
    peak = np.max(np.abs(x))
    if peak > 0.98:
        x = x / peak * 0.98
    wavfile.write(path, SR, (x.T * 32767).astype(np.int16))


def read_audio(path):
    """Читает любой аудиофайл через ffmpeg в стерео float SR."""
    import subprocess
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).T.astype(np.float64)
    return a
