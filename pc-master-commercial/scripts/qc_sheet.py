"""Контактный лист кадров из готового MP4: python3 scripts/qc_sheet.py video.mp4 out.jpg 0.5,1.2,...  [cols]"""
import subprocess, sys
from PIL import Image, ImageDraw
video, out, times = sys.argv[1], sys.argv[2], [float(x) for x in sys.argv[3].split(',')]
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 6
w, h = 432, 768
ims = []
for t in times:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', video, '-frames:v', '1', '-vf', f'scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    im = Image.frombytes('RGB', (w, h), raw) if len(raw) == w * h * 3 else Image.new('RGB', (w, h))
    ImageDraw.Draw(im).text((8, 8), f'{t:.2f}s', fill=(255, 255, 0))
    ims.append(im)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (w * cols, h * rows))
for i, im in enumerate(ims):
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
sheet.save(out, quality=85)
print(out)
