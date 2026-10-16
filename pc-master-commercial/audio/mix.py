"""Сборка звука: музыка + саунд-дизайн + голос (если добавлен) с автоматическим приглушением музыки под речь.

Запуск: python3 audio/mix.py            → out/audio/mix.wav (+ стемы в public/audio)
        python3 audio/mix.py --cut15    → out/audio/mix15.wav для 15-секундной версии
"""
import json
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import ROOT, SR, load_timeline, place, read_audio, write_wav  # noqa: E402
import music  # noqa: E402
import sfx  # noqa: E402


def voice_track(total):
    path = os.path.join(ROOT, 'src', 'generated', 'voice.json')
    with open(path, encoding='utf-8') as f:
        gen = json.load(f)
    v = np.zeros((2, int(total * SR) + SR))
    if gen.get('source', 'none') == 'none' or not gen.get('lines'):
        return v[:, : int(total * SR)], False
    for lid, line in gen['lines'].items():
        fp = os.path.join(ROOT, 'public', 'voice', line.get('file', f'{lid}.mp3'))
        if not os.path.exists(fp):
            print('  ! нет файла голоса', fp)
            continue
        place(v, read_audio(fp), line['start'])
    return v[:, : int(total * SR)], True


def duck_gain(voice, depth_db=-9.0, attack=0.04, release=0.35):
    """Огибающая приглушения музыки: быстро уходит вниз при речи, плавно возвращается."""
    mono = np.abs(voice).max(axis=0)
    hop = 240
    env = mono[: len(mono) // hop * hop].reshape(-1, hop).max(axis=1)
    out = np.zeros_like(env)
    a = np.exp(-hop / (attack * SR))
    r = np.exp(-hop / (release * SR))
    level = 0.0
    for i, x in enumerate(env):
        level = a * level + (1 - a) * x if x > level else r * level + (1 - r) * x
        out[i] = level
    k = np.clip(out / 0.05, 0, 1)
    g = 1 - (1 - 10 ** (depth_db / 20)) * k
    g = np.repeat(g, hop)
    return np.pad(g, (0, len(mono) - len(g)), constant_values=1.0)


def build():
    tl, starts, total = load_timeline()
    print('Сцены:', {k: round(v, 2) for k, v in starts.items()}, 'итого', total, 'с')
    print('Музыка…')
    mus = music.render(starts, total)
    print('Саунд-дизайн…')
    fx = sfx.render(starts, total)
    voice, has_voice = voice_track(total)
    n = min(mus.shape[1], fx.shape[1], voice.shape[1])
    mus, fx, voice = mus[:, :n], fx[:, :n], voice[:, :n]
    g = duck_gain(voice) if has_voice else np.ones(n)
    # без голоса музыка чуть тише запаса под речь не требует
    mix = mus * 0.62 * g + fx * 0.55 * (0.8 + 0.2 * g) + voice * 1.0
    peak = np.max(np.abs(mix))
    mix = mix / max(peak, 1e-9) * 0.89
    write_wav(os.path.join(ROOT, 'public', 'audio', 'music.wav'), mus / np.max(np.abs(mus)) * 0.89)
    write_wav(os.path.join(ROOT, 'public', 'audio', 'sfx.wav'), fx / np.max(np.abs(fx)) * 0.89)
    write_wav(os.path.join(ROOT, 'out', 'audio', 'mix.wav'), mix)
    print('Голос:', 'есть' if has_voice else 'нет (добавь через npm run voice / voice:import)')
    return mix


def cut15():
    """15-секундная версия: аудио собирается из тех же отрезков, что и видео (src/cut15.json)."""
    with open(os.path.join(ROOT, 'src', 'config', 'cut15.json'), encoding='utf-8') as f:
        cut = json.load(f)
    tl, starts, total = load_timeline()
    mus = music.render(starts, total)
    fx = sfx.render(starts, total)
    bed = mus * 0.62 + fx * 0.55
    voice, has_voice = voice_track(total)
    out = np.zeros((2, int(cut['duration'] * SR)))
    vout = np.zeros_like(out)
    xf = int(0.02 * SR)
    for seg in cut['segments']:
        a, b, d = seg['src'], seg['src'] + seg['len'], seg['dst']
        piece = bed[:, int(a * SR):int(b * SR)].copy()
        piece[:, :xf] *= np.linspace(0, 1, xf)
        piece[:, -xf:] *= np.linspace(1, 0, xf)
        place(out, piece, d)
    # голос: целые фразы, перечисленные в cut15.json, ставятся на свои места
    if has_voice:
        with open(os.path.join(ROOT, 'src', 'generated', 'voice.json'), encoding='utf-8') as f:
            gen = json.load(f)
        for vl in cut.get('voice', []):
            line = gen['lines'].get(vl['id'])
            if not line:
                continue
            fp = os.path.join(ROOT, 'public', 'voice', line.get('file', vl['id'] + '.mp3'))
            if os.path.exists(fp):
                place(vout, read_audio(fp), vl['at'])
        g = duck_gain(vout)
        out = out * g[: out.shape[1]]
    mix = out + vout
    mix = mix / max(np.max(np.abs(mix)), 1e-9) * 0.89
    fade = int(0.5 * SR)
    mix[:, -fade:] *= np.linspace(1, 0, fade)
    write_wav(os.path.join(ROOT, 'out', 'audio', 'mix15.wav'), mix)


if __name__ == '__main__':
    if '--cut15' in sys.argv:
        cut15()
    else:
        build()
