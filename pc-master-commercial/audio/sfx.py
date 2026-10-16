"""Саунд-дизайн: каждый звук привязан к действию в кадре.

Моменты внутри сцен совпадают с константами в src/scenes/*.tsx (указаны в комментариях).
"""
import numpy as np
from engine import (SR, adsr, logo_drop, cue, bp, buf, expdec, hp, lp, noise, note_hz, place, reverb, saw, sine, soft_clip, sweep_lp, tt)
from music import clean_boom, impact


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
    P(impact(1.0), h + 1.9)
    P(clean_boom(1.1, 1.8), h + 1.9)  # мощный чистый бас под заголовком
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

    # --- COOLING (S04Cooling.tsx → COOL: диагностика 0–2.7, радиатор 2.7–5.1 (воздух с 3.95), паста 5.1–6.7, установка 6.7, посадка 7.15) ---
    c = S['cooling']
    P(whoosh(0.6, 0.45, 400, 5000, 21), c - 0.1)
    n = int(1.3 * SR)
    P(lp(sine(820 + 500 * np.linspace(0, 1, n), n), 2500) * np.sin(np.pi * np.linspace(0, 1, n)) * 0.05, c + 0.3)  # мягкий тон скана
    for k, at in enumerate((0.8, 1.0, 1.2)):
        P(blip(1568 + k * 120, 0.12, 0.22), c + at, 1.0, -0.3 + k * 0.2)
    P(blip(740, 0.22, 0.3), c + 1.4)  # «перегрев» — ниже и мягче
    P(blip(587, 0.3, 0.22), c + 1.7)
    P(hiss(1.3, 0.22), c + 2.7)  # горячий радиатор
    P(fan_noise(1.2, 22, 9, 0.8, 0.12), c + 2.7)
    # чистка: мягкий воздушный звук сжатого воздуха, сопровождает насадку
    n = int(1.05 * SR)
    k_ = np.linspace(0, 1, n)
    air = sweep_lp(noise(n, 61), 2500 + 4000 * (1 - k_), q=0.8) * np.clip(k_ / 0.06, 0, 1) * (1 - k_) ** 0.6
    P(air * 0.42, c + 3.95, 1.0, 0.25)
    P(whoosh(0.4, 0.2, 200, 1500, 63), c + 4.5)
    # паста: салфетка, затем шприц
    n = int(0.38 * SR)
    P(bp(noise(n, 41), 900, 5000) * np.sin(np.pi * np.linspace(0, 1, n)) * 0.18, c + 5.28)
    n = int(0.35 * SR)
    P(lp(noise(n, 43), 500) * np.sin(np.pi * np.linspace(0, 1, n)) * 0.28, c + 5.9)
    # установка кулера: опускание, точная посадка, ровная раскрутка вентилятора
    P(whoosh(0.45, 0.3, 300, 2500, 33), c + 6.7)
    P(latch(0.9, 5), c + 7.15)
    P(thump(0.8, 65), c + 7.15)
    n = int(0.9 * SR)
    P(lp(saw(30 + 110 * np.linspace(0, 1, n) ** 0.6, n), 700) * np.sin(np.pi * np.linspace(0, 1, n) * 0.5) * 0.18, c + 7.2)
    P(fan_noise(1.0, 22, 9, 0.0, 0.15), c + 7.25)
    P(chime([86, 93], 0.18, 0.08, 0.6), c + 7.2)

    # --- SSD (S05SSD.tsx: медленный HDD 0–1.5, разгон камеры с 1.0, SWAP = cues.ssdSwap, UI = cues.ssdUI) ---
    s = S['ssd']
    sw = s + cue('ssdSwap')
    ui = s + cue('ssdUI')
    P(hdd(cue('ssdSwap'), 0.4, 5), s)
    P(whoosh(0.55, 0.75, 300, 9000, 51, 0.6, -0.6), sw - 0.5)  # speed ramp
    # технологический импульс превращения: восходящий «зап», чистый суб, стеклянный перезвон
    P(zap(0.35, 0.35), sw - 0.05)
    P(thump(1.0, 48, 0.22), sw)
    P(chime([81, 86, 93, 98], 0.32, 0.05, 1.0), sw + 0.02)
    for k in range(6):
        P(blip(2400 + k * 160, 0.05, 0.08), sw + 0.25 + k * 0.11, 1.0, -0.5 + k * 0.2)  # импульсы по SSD
    P(whoosh(0.3, 0.3, 600, 6000, 61), ui - 0.1)
    for k in range(5):
        P(click(0.25, 3200, 70 + k), ui + 0.12 + k * 0.08)  # быстрый прогресс установки
    P(chime([62, 69, 74, 78, 81], 0.4, 0.08, 1.0), ui + 0.5)  # мягкий звук запуска системы
    for k in range(6):
        P(blip(1400 + k * 120, 0.06, 0.09), ui + 0.55 + k * 0.035, 1.0, -0.4 + k * 0.16)
    for at_ in (1.15, 1.7):
        P(click(0.55, 2400, 80), ui + at_)
        P(blip(1760, 0.08, 0.12), ui + at_ + 0.06)  # окно открывается мгновенно
    P(chime([86, 93], 0.2, 0.07, 0.6), ui + 2.0)

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
