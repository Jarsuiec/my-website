"""Оригинальный трек PC MASTER: cinematic electronic + dark synthwave + bass music.

Ре минор, 120 BPM. Сетка тактов привязана к удару на появлении логотипа, поэтому
все монтажные склейки попадают в доли. Структура строится от таймингов сцен в timeline.json.
"""
import numpy as np
from engine import (SR, adsr, logo_drop, bp, buf, delay, expdec, hp, lp, noise, note_hz, place, reverb, saw, sine, soft_clip, square, sweep_lp, tt)

BEAT = 0.5

# --- ударные ---------------------------------------------------------------------
def kick(gain=1.0, tone=1.0):
    n = int(0.5 * SR)
    t = tt(n)
    f = 46 + 110 * tone * np.exp(-t / 0.035)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * expdec(n, 0.2)
    click = hp(noise(n, 3), 3000) * expdec(n, 0.004) * 0.5
    return soft_clip((body + click) * 1.4, 1.6) * gain


def snare(gain=1.0):
    n = int(0.45 * SR)
    tone = sine(185, n) * expdec(n, 0.05) * 0.6
    nz = bp(noise(n, 5), 1400, 9000) * expdec(n, 0.13)
    return (tone + nz) * gain


def clap(gain=1.0):
    n = int(0.5 * SR)
    x = np.zeros(n)
    nz = bp(noise(n, 9), 900, 6000)
    for k, off in enumerate([0, 0.011, 0.023]):
        i = int(off * SR)
        x[i:] += nz[: n - i] * expdec(n - i, 0.012 if k < 2 else 0.16)
    return x * gain


def hat(open_=False, gain=1.0, seed=11):
    n = int((0.35 if open_ else 0.08) * SR)
    return hp(noise(n, seed), 7500, 3) * expdec(n, 0.11 if open_ else 0.022) * gain


def crash(gain=1.0, sec=2.2):
    n = int(sec * SR)
    x = hp(noise(n, 21), 3500, 2) * expdec(n, 0.65)
    ring = sum(sine(f, n) for f in (3120, 4450, 5230)) * expdec(n, 0.4) * 0.05
    return (x + ring) * gain


def impact(gain=1.0, sec=2.4):
    n = int(sec * SR)
    t = tt(n)
    f = 28 + 90 * np.exp(-t / 0.12)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * expdec(n, 0.7)
    thud = lp(noise(n, 31), 900) * expdec(n, 0.08) * 0.9
    return soft_clip((sub * 1.2 + thud), 1.3) * gain


def riser(sec, gain=1.0, f0=300, f1=7000, seed=41):
    n = int(sec * SR)
    k = np.linspace(0, 1, n) ** 2
    x = noise(n, seed)
    y = sweep_lp(x, f0 + (f1 - f0) * k, q=2.0)
    tone = saw(80 + 500 * k, n) * 0.15
    return (y * 0.7 + lp(tone, 3000)) * (k ** 1.5) * gain


def reverse_cymbal(sec=0.9, gain=1.0):
    c = crash(1.0, sec)
    return c[::-1] * np.linspace(0, 1, len(c)) ** 2 * gain


# --- мелодические инструменты ----------------------------------------------------------
def pluck(midi, sec=0.32, gain=1.0, bright=1.0):
    n = int(sec * SR)
    f = note_hz(midi)
    x = saw(f, n) * 0.6 + square(f * 1.002, n, 0.3) * 0.3
    fc = 400 + 4200 * bright * np.exp(-tt(n) / 0.09)
    return sweep_lp(x, fc, q=1.3) * expdec(n, 0.22) * gain


def pad_chord(midis, sec, gain=1.0, cutoff=1800, attack=0.35, release=0.8):
    n = int((sec + release) * SR)
    out = np.zeros((2, n))
    for m in midis:
        for d, pan in ((-0.09, -0.7), (0.0, 0.0), (0.09, 0.7)):
            s = saw(note_hz(m + d), n, np.random.default_rng(m).random())
            l = np.cos((pan + 1) * np.pi / 4)
            r = np.sin((pan + 1) * np.pi / 4)
            out[0] += s * l
            out[1] += s * r
    out = lp(out, cutoff, 2) * adsr(n, attack, 0.3, 0.8, release, hold=sec) / (len(midis) * 2)
    return out * gain


def reese(midi, sec, cutoff_curve=None, gain=1.0):
    n = int(sec * SR)
    f = note_hz(midi)
    x = saw(f * 1.006, n) + saw(f * 0.994, n, 0.37) + sine(f / 2, n) * 1.4
    fc = cutoff_curve if cutoff_curve is not None else 420
    x = sweep_lp(x, fc, q=1.1)
    return soft_clip(x * 0.6, 1.8) * adsr(n, 0.004, 0.08, 0.85, 0.04) * gain


def lead(midi, sec, gain=1.0):
    n = int(sec * SR)
    t = tt(n)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.15) / 0.2, 0, 1)
    f = note_hz(midi) * vib
    x = saw(f, n) * 0.55 + square(f * 0.5, n, 0.1, 0.35) * 0.35 + saw(f * 1.004, n, 0.5) * 0.35
    x = lp(x, 3200)
    return x * adsr(n, 0.01, 0.15, 0.75, 0.08) * gain


# --- аранжировка -----------------------------------------------------------------------
CHORDS = [
    ([50, 53, 57, 62], 38),  # Dm
    ([46, 50, 53, 58], 34),  # Bb
    ([53, 57, 60, 65], 41),  # F
    ([48, 52, 55, 60], 36),  # C
]
ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 3, 2, 1, 3, 2, 1]
P1 = [(0, 74, 1.5), (1.5, 72, 0.5), (2, 74, 1), (3, 77, 1), (4, 76, 1.5), (5.5, 74, 0.5), (6, 72, 1), (7, 69, 1)]
P2 = [(0, 70, 1.5), (1.5, 69, 0.5), (2, 70, 1), (3, 74, 1), (4, 72, 2), (6, 76, 1), (7, 74, 1)]


def render(starts, total):
    S = starts
    drop = S['logo'] + logo_drop()  # синхронно с DROP в S03Logo.tsx
    anchor = drop  # такты отсчитываются от удара
    out = {k: buf(total + 3) for k in ('drums', 'bass', 'music', 'fx')}
    D, B, Mu, FX = out['drums'], out['bass'], out['music'], out['fx']
    sc = np.ones(out['bass'].shape[1])  # огибающая сайдчейна от бочки

    def bar_chord(t):
        i = int(np.floor((t - anchor + 1e-6) / 2.0)) % 4
        return CHORDS[i]

    def add_kick(t, g=1.0, tone=1.0):
        place(D, kick(g, tone), t)
        i0 = int(t * SR)
        n = int(0.32 * SR)
        if i0 < len(sc):
            m = min(n, len(sc) - i0)
            sc[i0:i0 + m] = np.minimum(sc[i0:i0 + m], 1 - 0.75 * np.exp(-np.arange(m) / (0.07 * SR)))

    # ===== HOOK: короткая «игровая» музыка, обрыв на зависании =====================
    g0 = S['hook'] + 1.05
    freeze = S['hook'] + 1.6  # = G0 + FREEZE в S01Hook.tsx
    game = buf(1.0)
    for k in range(int((freeze - g0) / 0.125) + 1):
        m = [64, 67, 71, 76, 71, 67][k % 6] + 12
        place(game, pluck(m, 0.2, 0.35, 1.2), k * 0.125, pan=0.3 if k % 2 else -0.3)
    for k in range(3):
        place(game, kick(0.7), k * 0.25)
    place(game, pad_chord([52, 59, 64, 67], 0.6, 0.5, 2600, 0.05, 0.2), 0)
    seg = game[:, : int((freeze - g0) * SR)].copy()
    place(Mu, seg, g0)
    # заедание буфера: последний кусочек повторяется, затем тишина
    grain = seg[:, -int(0.055 * SR):]
    for r in range(2):
        place(Mu, grain * (0.9 - r * 0.3), freeze + r * 0.055)
    # низкий гул под заголовком
    tH = S['hook'] + 1.9  # = titleAt в S01Hook.tsx
    dur = S['problem'] - tH
    n = int(dur * SR)
    drone = lp(saw(note_hz(26), n) + saw(note_hz(26.1), n, 0.4), 220) * np.linspace(0.3, 1, n) * 0.5
    place(Mu, drone, tH)
    for k in range(int((S['problem'] - (tH + 0.3)) / 0.5) + 1):
        place(D, kick(0.55, 0.5), tH + 0.3 + k * 0.5)
    place(FX, riser(1.15, 0.8, 200, 6000), S['problem'] - 1.15)

    # ===== PROBLEM: нарастающее напряжение ==========================================
    p0, p1 = S['problem'], S['logo']
    nb = int((p1 - p0) / BEAT)
    for k in range(nb):
        t = p0 + k * BEAT
        add_kick(t, 0.85, 0.8)
        if t >= p0 + 2.0:
            place(D, hat(False, 0.35), t + 0.25)
            place(D, hat(False, 0.18), t + 0.125)
            place(D, hat(False, 0.18), t + 0.375)
        if k % 2 == 1:
            place(D, clap(0.5), t)
    # бас: восьмые D с открывающимся фильтром
    for k in range(nb * 2):
        t = p0 + k * 0.25
        prog = k / (nb * 2)
        m = 38 if (k % 8) not in (6,) else 41
        place(B, reese(m, 0.24, 220 + 1500 * prog ** 1.6, 0.55), t)
    nP = int((p1 - p0) * SR)
    diss = pad_chord([50, 51, 57], p1 - p0, 0.35, 700, 1.0, 0.05)
    place(Mu, diss[:, :nP], p0)
    # дробь малого перед тишиной
    roll_t = p1 - 1.0
    k = 0
    t = roll_t
    while t < p1 - 0.02:
        step = 0.125 if t < p1 - 0.5 else 0.0625
        place(D, snare(0.25 + 0.6 * (t - roll_t)), t)
        t += step
        k += 1
    place(FX, riser(2.0, 0.9, 300, 9000), p1 - 2.0)
    # жёсткий обрыв: всё, что после p1 и до удара, глушим
    for st in (D, B, Mu, FX):
        i0, i1 = int(p1 * SR), int((drop - 0.6) * SR)
        st[:, i0:i1] = 0

    # ===== LOGO: тишина → обратная тарелка → удар ======================================
    place(FX, reverse_cymbal(0.9, 0.9), drop - 0.9)
    place(FX, riser(0.9, 0.4, 100, 2000, 7), drop - 0.9)

    # ===== GROOVE (логотип → игровой ПК → удалённая помощь) ============================
    g_end = S['trust']
    climax = S['gaming']
    nbeats = int(round((g_end - drop) / BEAT))
    place(FX, impact(1.3), drop)
    place(D, crash(0.8), drop)
    for k in range(nbeats):
        t = drop + k * BEAT
        hi = t >= climax
        add_kick(t, 1.0)
        if k % 4 in (1, 3):
            place(D, clap(0.7), t)
            place(D, snare(0.35), t)
        place(D, hat(False, 0.42), t + 0.25)
        place(D, hat(False, 0.2), t + 0.125)
        place(D, hat(False, 0.24), t + 0.375)
        if hi and k % 2 == 1:
            place(D, hat(True, 0.22), t + 0.25)
        if hi and k % 8 == 7:
            add_kick(t + 0.375, 0.6)
        # бас: восьмые с октавными прыжками
        chord, root = bar_chord(t)
        for e in range(2):
            m = root + (12 if (k * 2 + e) % 4 == 3 else 0)
            fc = 900 if hi else 650
            place(B, reese(m, 0.235, fc, 0.6), t + e * 0.25)
        # арпеджио шестнадцатыми
        for s in range(4):
            idx = ARP[(k * 4 + s) % 16]
            m = chord[idx] + 12
            place(Mu, pluck(m, 0.24, 0.16 if not hi else 0.2, 0.9), t + s * 0.125, pan=-0.35 if s % 2 else 0.35)
        # пэд на каждый такт
        if (k % 4) == 0:
            place(Mu, pad_chord(chord, 2.0, 0.55 if hi else 0.42, 2200 if hi else 1500, 0.15, 0.5), t)
            if hi:
                place(D, crash(0.35 if k % 8 else 0.6), t)
    # переходы-акценты на склейках
    for sc_id in ('cooling', 'ssd', 'gaming', 'remote'):
        place(FX, reverse_cymbal(0.5, 0.35), S[sc_id] - 0.5)
    place(FX, impact(0.8, 1.6), S['ssd'] + 2.0)  # превращение HDD → SSD
    place(D, crash(0.7), climax)
    # лид-мелодия в кульминации
    phrase = P1 + [(b + 8, m, l) for b, m, l in P2]
    cyc = 16
    k = 0
    while True:
        b0 = k * cyc
        done = False
        for b, m, l in phrase:
            t = climax + (b0 + b) * BEAT
            if t >= g_end - 0.05:
                done = True
                break
            place(Mu, lead(m, l * BEAT * 0.95, 0.32), t)
        if done:
            break
        k += 1

    # ===== TRUST: музыкальная пауза, тепло и спокойно ==================================
    t0, t1 = S['trust'], S['final']
    for b in range(int((t1 - t0) / 2)):
        t = t0 + b * 2
        chord, root = CHORDS[b % 4]
        place(Mu, pad_chord(chord, 2.0, 0.5, 1100, 0.4, 0.8), t)
        place(B, lp(sine(note_hz(root), int(2 * SR)) * adsr(int(2 * SR), 0.2, 0.2, 0.8, 0.4), 300) * 0.35, t)
        for s in range(8):
            place(Mu, pluck(chord[ARP[s]] + 12, 0.4, 0.09, 0.45), t + s * 0.25, pan=-0.4 if s % 2 else 0.4)

    # ===== FINAL: подъём → удар → кода ==================================================
    f0 = S['final']
    card = f0 + 1.0  # = CARD в S09Final.tsx
    place(FX, riser(1.0, 1.0, 300, 10000, 3), card - 1.0)
    t = card - 1.0
    while t < card - 0.02:
        place(D, snare(0.2 + 0.5 * (t - (card - 1.0))), t)
        t += 0.125 if t < card - 0.5 else 0.0625
    place(FX, impact(1.3), card)
    place(D, crash(0.9), card)
    cta = S['cta']
    nb = int(round((cta - card) / BEAT))
    for k in range(nb):
        t = card + k * BEAT
        add_kick(t, 1.0)
        if k % 4 in (1, 3):
            place(D, clap(0.7), t)
        place(D, hat(True, 0.2), t + 0.25)
        chord, root = CHORDS[(k // 4) % 4]
        for e in range(2):
            place(B, reese(root + (12 if e else 0), 0.235, 1100, 0.6), t + e * 0.25)
        for s in range(4):
            place(Mu, pluck(chord[ARP[(k * 4 + s) % 16]] + 12, 0.24, 0.2, 1.0), t + s * 0.125, pan=-0.35 if s % 2 else 0.35)
        if k % 4 == 0:
            place(Mu, pad_chord(chord, 2.0, 0.55, 2400, 0.1, 0.5), t)
    for b, m, l in P1[:4]:
        place(Mu, lead(m, l * BEAT * 0.95, 0.3), card + b * BEAT)
    # кода: финальный удар и атмосферный хвост
    place(FX, impact(1.2, 3.0), cta)
    place(D, crash(0.8, 3.0), cta)
    tail = total - cta + 1.0
    place(Mu, pad_chord([50, 57, 62, 64, 69], tail - 1.2, 0.7, 1600, 0.05, 1.2), cta)
    place(B, lp(sine(note_hz(38), int(tail * SR)) * expdec(int(tail * SR), 1.6), 200) * 0.5, cta)
    for s in range(12):
        place(Mu, pluck([62, 69, 74, 76][s % 4] + 12, 0.6, 0.1 * (1 - s / 12), 0.5), cta + 0.5 + s * 0.25, pan=-0.4 if s % 2 else 0.4)

    # --- сведение стемов ----------------------------------------------------------------
    B *= sc
    Mu *= 0.55 + 0.45 * sc
    drums = reverb(D, 0.12, 1.2, 7000)
    music = delay(Mu, 0.375, 0.35, 0.25)
    music = reverb(music, 0.3, 2.6, 6000)
    fx = reverb(FX, 0.25, 2.6, 6000)
    bass = lp(B, 4000)
    mix = drums * 0.75 + bass * 0.7 + music * 0.85 + fx * 0.7
    mix = hp(mix, 28)
    # абсолютная тишина: после зависания игры и перед появлением логотипа (хвосты ревербера тоже глушим)
    def gate(a, b):
        i0, i1 = int(a * SR), int(b * SR)
        r = int(0.006 * SR)
        mix[:, i0:i0 + r] *= np.linspace(1, 0, r)
        mix[:, i0 + r:i1] = 0
    gate(freeze + 0.11, tH - 0.005)
    gate(p1, drop - 0.9)
    n = int(total * SR)
    mix = mix[:, :n]
    # мягкий фейд в самом конце
    fade = int(1.4 * SR)
    mix[:, -fade:] *= np.linspace(1, 0, fade) ** 2
    return mix
