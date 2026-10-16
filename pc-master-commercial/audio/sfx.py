"""Саунд-дизайн: каждый звук привязан к действию в кадре.

Моменты внутри сцен совпадают с константами в src/scenes/*.tsx (указаны в комментариях).
"""
import numpy as np
from engine import (SR, adsr, logo_drop, bp, buf, expdec, hp, lp, noise, note_hz, place, reverb, saw, sine, soft_clip, sweep_lp, tt)
from music import impact


def click(gain=1.0, f=2400, seed=1, body=0.0):
    n = int(0.09 * SR)
    x = bp(noise(n, seed), f * 0.6, f * 2.2) * expdec(n, 0.006)
    x += sine(f * 0.5, n) * expdec(n, 0.012) * 0.3
    if body:
        x += sine(120, n) * expdec(n, 0.03) * body
    return x * gain


def latch(gain=1.0, seed=3):
    """Механический щелчок фиксатора (память, видеокарта)."""
    n = int(0.16 * SR)
    a = click(1.0, 3200, seed)
    b = click(0.7, 1800, seed + 1, 0.4)
    x = np.zeros(n)
    x[: len(a)] += a
    i = int(0.018 * SR)
    x[i:i + len(b)] += b[: n - i]
    return x * gain


def thump(gain=1.0, f=70, tau=0.09):
    n = int(0.4 * SR)
    t = tt(n)
    ff = f + 60 * np.exp(-t / 0.02)
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * expdec(n, tau) * gain


def whoosh(sec, gain=1.0, f0=300, f1=4000, seed=5, pan_from=-0.6, pan_to=0.6):
    n = int(sec * SR)
    k = np.linspace(0, 1, n)
    env = np.sin(np.pi * k) ** 1.5
    x = sweep_lp(noise(n, seed), f0 + (f1 - f0) * np.sin(np.pi * k * 0.5), q=1.6) * env
    pan = pan_from + (pan_to - pan_from) * k
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    return np.vstack([x * l, x * r]) * 1.4 * gain


def glitch_burst(sec=0.25, gain=1.0, seed=7):
    n = int(sec * SR)
    r = np.random.default_rng(seed)
    x = np.zeros(n)
    i = 0
    while i < n:
        L = int(r.uniform(0.008, 0.04) * SR)
        kind = r.integers(0, 3)
        seg = np.arange(min(L, n - i))
        if kind == 0:
            x[i:i + len(seg)] = np.sign(np.sin(2 * np.pi * r.uniform(200, 2400) * seg / SR)) * 0.5
        elif kind == 1:
            x[i:i + len(seg)] = np.round(r.standard_normal(len(seg)) * 2) / 4
        i += L + int(r.uniform(0, 0.02) * SR)
    return hp(x, 150) * gain


def fan_noise(sec, rps=25, blades=9, dusty=1.0, gain=1.0, seed=13):
    """Шум вентилятора: широкополосный поток + тон лопастей + дребезг от пыли/подшипника."""
    n = int(sec * SR)
    t = tt(n)
    air = lp(hp(noise(n, seed), 120), 2200) * 0.6
    tone = sine(rps * blades, n) * 0.18 + sine(rps * blades * 2, n) * 0.06
    rattle = bp(noise(n, seed + 1), 600, 3000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * rps * t))) * 0.35 * dusty
    wob = 1 + 0.15 * np.sin(2 * np.pi * 1.3 * t) * dusty
    env = np.clip(t / 0.25, 0, 1) * np.clip((sec - t) / 0.2, 0, 1)
    return (air + tone + rattle) * wob * env * gain


def hiss(sec, gain=1.0, seed=17):
    n = int(sec * SR)
    t = tt(n)
    x = hp(noise(n, seed), 3000) * 0.4
    r = np.random.default_rng(seed)
    crackle = np.zeros(n)
    idx = r.integers(0, n, int(sec * 60))
    crackle[idx] = r.uniform(-1, 1, len(idx))
    crackle = bp(crackle, 1500, 8000) * 3
    env = np.clip(t / 0.3, 0, 1) * np.clip((sec - t) / 0.3, 0, 1)
    return (x + crackle) * env * gain


def hdd(sec, gain=1.0, seek_rate=7):
    n = int(sec * SR)
    t = tt(n)
    whine = (sine(120, n) * 0.2 + sine(240, n) * 0.08 + sine(7200 / 60 * 31, n) * 0.015)
    x = whine * np.clip(t / 0.2, 0, 1)
    out = np.zeros(n)
    out += x
    for k in range(int(sec * seek_rate)):
        i = int(k / seek_rate * SR)
        c = click(0.8, 1600 + (k % 3) * 400, k)
        out[i:i + len(c)] += c[: n - i]
    return out * gain


def zap(sec=0.6, gain=1.0, up=True):
    n = int(sec * SR)
    k = np.linspace(0, 1, n)
    f = (300 + 2600 * k ** 2) if up else (2600 - 2300 * k)
    x = saw(f, n) * 0.3 + sine(f * 2.01, n) * 0.3
    x = lp(x, 6000) * np.sin(np.pi * k) ** 0.7
    sparkle = hp(noise(n, 23), 6000) * (np.random.default_rng(1).random(n) > 0.995) * 3
    return (x + sparkle) * gain


def blip(f=1760, sec=0.12, gain=1.0):
    n = int(sec * SR)
    return (sine(f, n) + sine(f * 2, n) * 0.25) * adsr(n, 0.002, 0.05, 0.3, 0.05) * gain


def chime(notes, gain=1.0, spacing=0.09, decay=0.9):
    """Мягкий «стеклянный» перезвон: частичные с негармоническими обертонами."""
    total = spacing * len(notes) + decay * 2.5
    out = np.zeros(int(total * SR))
    for i, m in enumerate(notes):
        n = int(decay * 2.5 * SR)
        f = note_hz(m)
        x = sine(f, n) + sine(f * 2.76, n) * 0.25 * expdec(n, decay * 0.3) + sine(f * 5.4, n) * 0.08 * expdec(n, decay * 0.15)
        x *= expdec(n, decay) * np.clip(tt(n) / 0.003, 0, 1)
        i0 = int(i * spacing * SR)
        out[i0:i0 + n] += x
    return out * gain


def audio_logo(gain=1.0):
    """Звуковой логотип PC MASTER: восходящая тройка D–A–D + суб-удар + блеск."""
    c = chime([74, 81, 86], 1.0, 0.11, 1.1)
    th = thump(1.0, 55, 0.25)
    sh = hp(noise(int(1.2 * SR), 77), 7000) * expdec(int(1.2 * SR), 0.25) * 0.15
    n = max(len(c), len(th), len(sh))
    out = np.zeros(n)
    out[: len(c)] += c * 0.55
    out[: len(th)] += th * 0.8
    out[: len(sh)] += sh
    return out * gain


def air_blast(sec=0.6, gain=1.0):
    n = int(sec * SR)
    k = np.linspace(0, 1, n)
    x = bp(noise(n, 29), 1800, 9000) * np.clip(k / 0.05, 0, 1) * (1 - k) ** 1.2
    return x * gain


def render(starts, total):
    S = starts
    out = buf(total + 3)

    def P(x, t, g=1.0, pan=0.0):
        place(out, x, t, g, pan)

    # --- HOOK (S01Hook.tsx: нажатие 0.3, LED 0.45, игра 1.05, зависание 1.6, заголовок 1.9, проваливание 2.85) ---
    h = S['hook']
    P(click(1.0, 2600, 2, 0.6), h + 0.3, 0.9)
    P(thump(0.9, 60), h + 0.32)
    n = int(0.9 * SR)
    P(lp(sine(70 + 280 * np.linspace(0, 1, n) ** 2, n), 900) * np.sin(np.pi * np.linspace(0, 1, n)) * 0.35, h + 0.42)  # запуск системы
    P(fan_noise(0.6, 20, 9, 0.0, 0.25), h + 0.45)
    P(whoosh(0.35, 0.5, 400, 5000, 3), h + 0.9)
    P(glitch_burst(0.1, 0.7, 9), h + 1.6)
    P(impact(1.1), h + 1.9)
    P(glitch_burst(0.12, 0.5, 4), h + 1.9, 1.0, 0.3)
    P(whoosh(1.15, 0.9, 200, 9000, 8, 0, 0), h + 2.85)  # провал в экран

    # --- PROBLEM (S02Problem.tsx: слова 0.5 / 2.0 / 3.5, кадры: вентилятор 0–2, жар 2–3.5, HDD 3.5–6) ---
    p = S['problem']
    P(whoosh(0.9, 0.7, 300, 6000, 11, -0.8, 0.8), p - 0.05)
    P(fan_noise(2.2, 30, 9, 1.0, 0.55), p + 0.1)
    P(fan_noise(1.6, 30, 9, 1.0, 0.35), p + 2.0)
    P(hiss(1.6, 0.35), p + 2.0)
    P(hdd(2.5, 0.45), p + 3.5)
    for w in (0.5, 2.0, 3.5):
        P(thump(0.9, 50, 0.15), p + w)
        P(click(0.5, 1200, int(w * 10), 0.3), p + w)
    P(glitch_burst(0.25, 0.4, 12), p + 4.5)
    P(glitch_burst(0.6, 0.55, 13), p + 5.25)

    # --- LOGO (S03Logo.tsx: линии 0.25–1.4, DROP 1.5) ---
    lg = S['logo']
    dl = logo_drop() - 1.5  # сдвиг, если удар перенесён
    for k in range(9):
        P(blip(2200 + k * 180, 0.06, 0.12), lg + dl + 0.3 + k * 0.12, 1.0, -0.6 + k * 0.15)
    P(zap(0.9, 0.18), lg + dl + 0.55)
    P(audio_logo(1.0), lg + logo_drop())

    # --- COOLING (S04Cooling.tsx: метки 0.35/0.6/0.85/1.05; чистка с 2.0: продувка 0.05, снятие 0.55, стирание 1.0, паста 1.5, установка 2.45) ---
    c = S['cooling']
    P(whoosh(0.6, 0.5, 400, 5000, 21), c - 0.1)
    P(fan_noise(2.0, 22, 9, 0.6, 0.25), c)
    n = int(1.4 * SR)
    P(lp(sine(900, n) * (np.sin(2 * np.pi * 3 * tt(n)) > 0), 3000) * 0.04 * np.linspace(1, 0, n), c + 0.15)  # скан
    for k, at in enumerate((0.35, 0.6, 0.85, 1.05)):
        P(blip(1320 if k == 0 else 1760, 0.12, 0.25 if k else 0.3), c + at, 1.0, -0.3 + k * 0.2)
    A = c + 2.0
    P(air_blast(0.6, 0.6), A + 0.05)
    P(whoosh(0.5, 0.4, 300, 3000, 31), A + 0.55)  # кулер вверх
    P(bp(noise(int(0.35 * SR), 41), 800, 4000) * np.sin(np.pi * np.linspace(0, 1, int(0.35 * SR))) * 0.25, A + 1.0)  # протирка
    P(lp(noise(int(0.3 * SR), 43), 600) * np.sin(np.pi * np.linspace(0, 1, int(0.3 * SR))) * 0.3, A + 1.5)  # паста
    P(whoosh(0.5, 0.35, 300, 2500, 33), A + 1.95)
    P(latch(0.9, 5), A + 2.45)
    P(thump(0.8, 65), A + 2.45)
    P(fan_noise(2.6, 22, 9, 0.0, 0.18), A + 2.5)  # чистый ровный звук
    P(chime([86, 93], 0.18, 0.08, 0.6), A + 2.5)

    # --- SSD (S05SSD.tsx: разбор 1.35–2.0, SWAP 2.0, интерфейс 3.9, рабочий стол +0.95) ---
    s = S['ssd']
    P(hdd(2.0, 0.35, 5), s)
    for k in range(5):
        P(click(0.4, 3000 - k * 300, 50 + k), s + 1.4 + k * 0.12, 1.0, -0.5 + k * 0.25)
    P(whoosh(0.7, 0.6, 500, 9000, 51, 0.8, -0.8), s + 1.35)
    P(glitch_burst(0.15, 0.3, 21), s + 1.95)
    P(chime([81, 86, 93, 98], 0.3, 0.06, 1.0), s + 2.0)
    ui = s + 3.9
    P(whoosh(0.4, 0.35, 600, 6000, 61), ui - 0.1)
    for k in range(6):
        P(blip(1400 + k * 120, 0.07, 0.1), ui + 1.0 + k * 0.06, 1.0, -0.4 + k * 0.16)
    P(chime([62, 69, 74, 78, 81], 0.4, 0.12, 1.2), ui + 0.95)  # мягкий звук запуска системы

    # --- GAMING (S06Gaming.tsx ASSEMBLY) ---
    gm = S['gaming']
    AS = {'cpu': 0.95, 'ram1': 1.35, 'ram2': 1.55, 'gpu': 2.05, 'cooler': 2.55, 'case': 3.05, 'power': 3.35}
    for key, at in AS.items():
        if key == 'power':
            continue
        P(whoosh(0.4, 0.25, 500, 4000, int(at * 100)), gm + at - 0.4)
        if key in ('ram1', 'ram2', 'gpu'):
            P(latch(1.0, int(at * 10)), gm + at, 1.0, 0.2 if key != 'gpu' else -0.2)
        elif key == 'cpu':
            P(click(0.8, 1800, 71, 0.5), gm + at)
        elif key == 'cooler':
            P(latch(0.7, 77), gm + at)
            P(thump(0.6, 70), gm + at)
        else:
            P(thump(1.0, 55, 0.12), gm + at)
            P(click(0.6, 900, 79, 0.8), gm + at)
    pw = gm + AS['power']
    n = int(1.2 * SR)
    P(lp(saw(40 + 120 * np.linspace(0, 1, n) ** 0.5, n), 800) * np.sin(np.pi * np.linspace(0, 1, n) * 0.5) * 0.25, pw)  # раскрутка
    P(audio_logo(0.35), pw)
    P(fan_noise(2.4, 18, 9, 0.0, 0.12), pw + 0.3)
    P(whoosh(1.2, 0.35, 200, 3000, 81, -0.8, 0.8), pw + 0.8)

    # --- REMOTE (S07Remote.tsx REMOTE: beam 0.7, dialog 1.0, click 1.9, steps 2.45/2.95/3.45, done 3.95) ---
    rm = S['remote']
    P(whoosh(0.8, 0.5, 300, 5000, 91, 0.8, -0.6), rm - 0.1)
    P(zap(0.7, 0.35), rm + 0.7)
    P(blip(1046, 0.18, 0.25), rm + 1.0)
    P(click(0.7, 2200, 93), rm + 1.9)
    P(chime([79, 86], 0.25, 0.07, 0.5), rm + 1.95)
    for at in (2.45, 2.95, 3.45):
        P(blip(1568, 0.1, 0.22), rm + at)
    P(chime([74, 81, 86], 0.25, 0.08, 0.8), rm + 3.95)

    # --- TRUST (S08Trust.tsx: пункты 0.35 / 1.55) ---
    tr = S['trust']
    P(whoosh(0.9, 0.25, 200, 2000, 101), tr - 0.3)
    for at in (0.35, 1.55):
        P(blip(880, 0.25, 0.25), tr + at)
        P(chime([69], 0.15, 0.1, 0.6), tr + at)

    # --- FINAL (S09Final.tsx: отлёт 0–1.0, CARD 1.0) ---
    fn = S['final']
    P(whoosh(1.0, 0.9, 200, 9000, 111, -0.2, 0.2), fn)
    P(audio_logo(0.8), fn + 1.0)

    # --- CTA ---
    ct = S['cta']
    P(audio_logo(1.0), ct)
    P(blip(1318, 0.15, 0.15), ct + 0.35)

    mix = reverb(out, 0.18, 1.8, 7000)
    # тишина синхронно с музыкой: после зависания и перед линией-импульсом логотипа
    for a, b in ((h + 1.6 + 0.11, h + 1.895), (S['logo'], S['logo'] + 0.25)):
        mix[:, int(a * SR):int(b * SR)] = 0
    return mix[:, : int(total * SR)]
