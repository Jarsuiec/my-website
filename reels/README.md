# Reels / Shorts из кода

Вертикальные ролики 1080×1920 (30 fps, MP4): твои клипы на фоне + анимированная графика
(заголовки, субтитры, ДО/ПОСЛЕ, HDD → SSD, карточка с Telegram).

## Как сделать ролик

1. Сними клипы по раскадровке (отрендерь ролик без клипов — на месте каждого кадра будет
   подсказка «что снимать»).
2. Положи их в `videos/<ролик>/clips/` с именами из `video.json` (`01.mp4`, `02.mp4`…).
   Подходит любое видео с телефона — горизонтальное обрежется под вертикаль.
3. Запиши озвучку целиком одним файлом → `videos/<ролик>/voice.mp3`.
   Музыка (необязательно) → `music.mp3`, играет тихо на фоне.
4. Запусти:

```bash
node reels/engine/render.mjs reels/videos/02-hdd-ssd
# готовое видео: reels/videos/02-hdd-ssd/out.mp4
```

Нужны Node.js, `playwright` и `ffmpeg`.

## video.json

| Поле сцены | Что делает |
|---|---|
| `t: [от, до]` | время в секундах, сцены идут подряд |
| `type` | `hook` (крупная плашка), `caption` (по умолчанию), `timer` (ДО/ПОСЛЕ), `swap` (HDD → SSD), `chips` (список), `intro` (имя), `cta` (контакты) |
| `text` | текст на экране: `[слово]` — салатовая плашка, `{слово}` — красная, `\|` — перенос строки |
| `voice` | что говоришь — показывается субтитрами по словам |
| `shot` | что в кадре (подсказка для съёмки) |
| `clip` | файл клипа или список файлов (быстрая нарезка) |
| `in` | с какой секунды клипа начать |
| `speed` | ускорение (2 = ×2) |
| `clipAudio` | громкость звука из клипа (например, шум вентилятора: `0.7`) |
| `seconds` | для `timer`: **реальное** время загрузки с секундомера; `null` = ещё не замерено |

Новый ролик: скопируй `videos/_template` и поменяй тексты.

## Озвучка, музыка и иллюстрации без съёмки

```bash
sudo apt install rhvoice rhvoice-russian           # один раз
node reels/engine/tts.mjs reels/videos/01-noutbuk-greetsya             # мужской голос aleksandr-hq
node reels/engine/tts.mjs reels/videos/01-noutbuk-greetsya --voice artemiy --rate 120
node reels/engine/beat.mjs reels/videos/01-noutbuk-greetsya/music.mp3 40   # фоновый бит
```

`tts.mjs` озвучивает поле `voice` каждой сцены (поле `say` — если надо поправить
произношение, например «Windows» → «виндоус»), удлиняет сцены, если фраза не влезает,
и пишет `voice.wav`. Мужские голоса: aleksandr-hq, aleksandr, artemiy, mikhail, pavel, vitaliy, yuriy, evgeniy-rus.

Поле сцены `art` — анимированная иллюстрация вместо съёмки, пока нет клипа:
`hotLaptop`, `openCover`, `dustFan`, `dryPaste`, `cleaning`, `cool` (см. `engine/art.js`).
Как только кладёшь настоящий клип — он заменяет иллюстрацию.

## Свой голос из ElevenLabs

Озвучь в ElevenLabs весь текст ролика одним файлом, оставляя пустую строку (паузу) между фразами
сцен, скачай MP3 и выровняй ролик по нему:

```bash
node reels/engine/align.mjs reels/videos/01-noutbuk-greetsya ~/Downloads/ElevenLabs_....mp3
node reels/engine/render.mjs reels/videos/01-noutbuk-greetsya
```

`align.mjs` находит паузы, ставит начало каждой сцены на начало её фразы и синхронизирует субтитры.
