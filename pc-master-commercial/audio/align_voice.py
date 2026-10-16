"""Выравнивание готовой озвучки по тексту сценария без распознавания речи.

1. Находим фрагменты речи между паузами (ffmpeg silencedetect).
2. Делим текст реплик на предложения.
3. Динамическим программированием раскладываем предложения по фрагментам:
   каждое предложение = один или несколько подряд идущих фрагментов (запятые дают короткие паузы внутри).
   Стоимость — расхождение длительности с ожидаемой (по числу символов и средней скорости речи)
   плюс штраф за длинную паузу внутри предложения.
4. Время слов внутри предложения распределяется по длине слов — для субтитров.

Запуск: python3 audio/align_voice.py voice.mp3  → JSON в stdout.
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def speech_segments(path, noise='-40dB', d=0.1):
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout)
    err = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', f'silencedetect=noise={noise}:d={d}', '-f', 'null', '-'], capture_output=True, text=True).stderr
    sil = []
    s0 = None
    for line in err.splitlines():
        m = re.search(r'silence_start: ([\d.]+)', line)
        if m:
            s0 = float(m.group(1))
        m = re.search(r'silence_end: ([\d.]+)', line)
        if m and s0 is not None:
            sil.append((s0, float(m.group(1))))
            s0 = None
    if s0 is not None:
        sil.append((s0, dur))
    segs = []
    t = 0.0
    for a, b in sil:
        if a - t > 0.05:
            segs.append([t, a])
        t = b
    if dur - t > 0.05:
        segs.append([t, dur])
    return segs, dur


def sentences(text):
    return [s.strip() for s in re.findall(r'[^.?!]+[.?!]?', text) if s.strip()]


def align(path, voice):
    segs, total = speech_segments(path)
    sents = []  # (line_id, text)
    for v in voice:
        for s in sentences(v['text']):
            sents.append((v['id'], s))
    m, n = len(sents), len(segs)
    if n < m:
        raise SystemExit(f'Фрагментов речи ({n}) меньше, чем предложений ({m}): паузы между фразами слишком короткие.')
    chars = [len(re.sub(r'[^\wА-Яа-яЁё]', '', s)) + 2 for _, s in sents]
    speech = sum(b - a for a, b in segs)
    rate = speech / sum(chars)
    INF = float('inf')
    # dp[i][j] — лучшая стоимость для первых i предложений на первых j фрагментах
    dp = [[INF] * (n + 1) for _ in range(m + 1)]
    back = [[0] * (n + 1) for _ in range(m + 1)]
    dp[0][0] = 0.0
    for i in range(1, m + 1):
        exp = chars[i - 1] * rate
        for j in range(i, n - (m - i) + 1):
            for k in range(i - 1, j):
                if dp[i - 1][k] == INF:
                    continue
                a, b = segs[k][0], segs[j - 1][1]
                inner = sum(segs[q + 1][0] - segs[q][1] for q in range(k, j - 1))
                longest = max([segs[q + 1][0] - segs[q][1] for q in range(k, j - 1)], default=0)
                c = ((b - a - inner) - exp) ** 2 / max(exp, 0.3) + 6.0 * longest ** 2 + 0.4 * (j - k - 1)
                if dp[i - 1][k] + c < dp[i][j]:
                    dp[i][j] = dp[i - 1][k] + c
                    back[i][j] = k
    j = n
    spans = []
    for i in range(m, 0, -1):
        k = back[i][j]
        spans.append((segs[k][0], segs[j - 1][1]))
        j = k
    spans.reverse()
    out = {}
    for (lid, text), (a, b), ch in zip(sents, spans, chars):
        out.setdefault(lid, []).append({'text': text, 'start': a, 'end': b, 'ratio': round((b - a) / (ch * rate), 2)})
    lines = []
    for v in voice:
        ss = out[v['id']]
        a = max(0.0, ss[0]['start'] - 0.04)
        b = min(total, ss[-1]['end'] + 0.08)
        words = []
        for s in ss:
            ws = s['text'].split()
            wl = [len(w) + 1 for w in ws]
            tot = sum(wl)
            t = s['start']
            for w, l in zip(ws, wl):
                d = (s['end'] - s['start']) * l / tot
                words.append({'w': w, 's': round(t - a, 3), 'e': round(t + d - a, 3)})
                t += d
        lines.append({'id': v['id'], 'start': round(a, 3), 'end': round(b, 3), 'sentences': ss, 'words': words})
    return {'duration': total, 'rate': rate, 'segments': len(segs), 'lines': lines}


if __name__ == '__main__':
    with open(os.path.join(ROOT, 'src', 'config', 'timeline.json'), encoding='utf-8') as f:
        tl = json.load(f)
    res = align(sys.argv[1], tl['voice'])
    print(json.dumps(res, ensure_ascii=False, indent=1))
