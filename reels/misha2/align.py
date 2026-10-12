"""Auto-align the known voice text: vowel-energy peaks act as a time warp for syllables,
then each sentence start snaps to the nearest real pause. Writes script.json + assets/peaks.json."""
import json, re, subprocess
import numpy as np
VOICE = 'assets/voice.mp3'
SENT = ["[Шукаєш] роботу в [Польщі?]", "Знайоме, правда?",
  "Дзвониш за оголошенням — а там: «Ой, вакансія вже {неактуальна}»...", "ще з {минулого року.}",
  "Привіт!", "Я [Міша,] рекрутер агенції [Софіус Груп.]",
  "І я допомагаю людям знайти нормальну роботу в [готелях Польщі] — <без нервів> і <без сюрпризів.>",
  "Золотих гір обіцяти {не буду...}", "гори в Польщі взагалі тільки на [півдні.]",
  "Зате [чесно] поясню всі умови — ще до того, як ти кудись поїдеш.",
  "Зараз шукаємо [покоївок,] [кухарів,] працівників [денного] і [нічного] сервісу, а ще — людей на прибирання [аквапарків.]",
  "[Варшава,] [Гданськ,] [Краків,] [Міжздроє,] [Миколайки,] [Оструда] — і це ще не всі міста.",
  "Підбір — <безкоштовний!>", "Працевлаштування — <офіційне!>", "А в деяких містах — [аванс] і [житло] від компанії.",
  "Пиши в [Телеграм,] [Вотсап] чи [Месенджер,] або дзвони:", "[+48|4] [731|6] [292|7] [633|5]",
  "[Напиши Міші] — разом знайдемо вакансію, яка тобі <ПІДХОДИТЬ!>"]
VOW = re.compile('[аеєиіїоуюя]', re.I)
def syl(s):
    n = 0
    for tok in re.sub(r'[\[\]{}<>]', '', s).split():
        n += int(tok.split('|')[1]) if '|' in tok else max(1, len(VOW.findall(tok))) if VOW.search(tok) else 0
    return max(1, n)
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', VOICE, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True).stdout
x = np.frombuffer(raw, np.float32); dur = len(x) / 16000
X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / 16000); X[(f < 300) | (f > 2500)] = 0; y = np.fft.irfft(X, len(x))
hop = 160; n = len(y) // hop
db = 20 * np.log10(np.array([np.sqrt(np.mean(y[i * hop:(i + 1) * hop] ** 2)) for i in range(n)]) + 1e-6)
k = np.hanning(7); k /= k.sum(); d = np.convolve(db, k, 'same'); thr = d.max() - 32
peaks = [i * hop / 16000 for i in range(2, n - 2) if d[i] > thr and d[i] == d[max(0, i - 6):i + 7].max()
         and d[i] - d[max(0, i - 12):i].min() > 2.5 and d[i] - d[i + 1:i + 13].min() > 2.5]
json.dump([round(p, 3) for p in peaks], open('assets/peaks.json', 'w'))
out = subprocess.run(['ffmpeg', '-i', VOICE, '-af', 'silencedetect=noise=-32dB:d=0.08', '-f', 'null', '-'], capture_output=True, text=True).stderr
st = [float(v) for v in re.findall(r'silence_start: ([\d.]+)', out)]; en = [float(v) for v in re.findall(r'silence_end: ([\d.]+)', out)]
pauses = list(zip(st, en))
start = en[0] if st and st[0] < .05 else 0.0
endv = st[-1] if st and en[-1] > dur - .05 else dur
P = np.array([start] + peaks + [endv]); P = P[(P >= start) & (P <= endv)]
S = [syl(s) for s in SENT]; tot = sum(S)
def warp(frac):  # syllable fraction -> time, piecewise-linear through the peaks
    pos = frac * (len(P) - 1); i = int(min(pos, len(P) - 2)); return P[i] + (P[i + 1] - P[i]) * (pos - i)
starts, acc = [], 0
for s in S: starts.append(warp(acc / tot)); acc += s
snapped = [starts[0]]
for t in starts[1:]:
    cands = [e for a, e in pauses if abs(e - t) < .45]
    snapped.append(min(cands, key=lambda e: abs(e - t)) if cands else t)
chunks = []
for i, s in enumerate(SENT):
    a = snapped[i]; b = snapped[i + 1] if i + 1 < len(SENT) else endv
    pz = [p for p, e in pauses if a < p <= b and abs(e - b) < .02]
    chunks.append({'t': [round(a, 2), round(pz[0] if pz else b - .05, 2)], 'text': s})
    print(f"{a:6.2f} {'*' if abs(a - starts[i]) > .01 else ' '} {s[:58]}")
json.dump({'_doc': 'auto-aligned by align.py; tweak times here if a line drifts', 'chunks': chunks}, open('script.json', 'w'), ensure_ascii=False, indent=1)
