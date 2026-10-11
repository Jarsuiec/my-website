# Demo reel (code-generated)

Vertical 1080×1920 motion-graphics video rendered from code: `scene.html` exposes a
deterministic `render(t)`; `render.mjs` steps it frame by frame in headless Chromium
(Playwright) and pipes the frames into ffmpeg.

```bash
node reels/demo/render.mjs out.mp4   # needs playwright + ffmpeg
```

Edit texts/timings in `scene.html` (each scene has a `win(t, start, end)` window).
