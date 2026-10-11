# Живые кадры для ролика: что сгенерировать отдельно

Ролик уже собран целиком кодом: 3D-модели, интерфейсы, графика. Но три момента из брифа требуют
**настоящей кинематографической съёмки**, которую код не нарисует: ночную Варшаву, человека
за ноутбуком и человека у мусорного бака. Их можно сгенерировать в AI-видео (Kling, Google Veo,
Runway Gen-4, Sora, Hailuo) или снять самому. Каждый клип автоматически встанет в свою сцену.

**Общие требования ко всем клипам:**
- вертикально **9:16**, лучше 1080×1920, MP4;
- без текста, логотипов, водяных знаков и субтитров (надписи добавляет проект);
- длительность не меньше указанной (лишнее обрежется);
- цвет: графит, электрический голубой, бирюза; оранжевый только для «перегрева».

**Чего не просить:** лицо Ярослава. В кадре мастера только руки и силуэт со спины. Человек в
сценах 2 и 9 — это клиент, а не Ярослав, это нормально.

**Как вставить клип:** положи файл в `reels/promo/clips/` и пропиши путь в `promo.json`:

```json
{ "id": "intro", "t": [0, 6.10], "clip": "clips/01-warsaw.mp4", "in": 0.0 }
```

`in` — с какой секунды клипа начинать. Потом `node reels/promo/render.mjs`.
Клип заменит код-фон сцены, а заголовки, субтитры и эффекты останутся поверх.

---

## Клип 1 — сцена «Знакомство» (0–6,1 с) → `clips/01-warsaw.mp4`, ≥ 7 с

**Prompt:**
> Cinematic vertical 9:16 aerial shot of Warsaw at blue hour, Palace of Culture and Science and
> modern glass skyscrapers (Varso Tower, Złota 44) glowing with warm and cool window lights, light
> trails on the streets below, slow drone push-in toward one lit office window, then a smooth match
> cut into a modern dark computer repair workshop: close-up of a technician's hands (no face) with
> an anti-static wrist strap working on an open PC case, motherboard and fans lit by soft cyan and
> electric blue rim light, shallow depth of field, anamorphic lens flares, premium tech commercial
> look, graphite and teal color grade, 24fps film grain.

**Negative:** text, logos, watermark, faces, people's faces, cartoon, oversaturated, fisheye.

---

## Клип 2 — сцена «Ноутбук-самолёт» (6,1–14,05 с) → `clips/02-laptop.mp4`, ≥ 8 с

**Prompt:**
> Vertical 9:16 cinematic medium shot, a calm young man working on a laptop at a home desk in the
> evening with a coffee mug and sticky notes; suddenly the laptop fan gets extremely loud, papers
> and sticky notes flutter away from the laptop's side vent as if from a jet engine, the man leans
> back in ironic disbelief looking at the laptop, subtle comedic timing, slight camera shake, warm
> orange heat haze near the vent, then he checks his watch and sips coffee while the screen is
> frozen. Realistic, premium commercial lighting, shallow depth of field, graphite and electric blue
> palette with orange accents.

**Negative:** explosion, fire, smoke, broken laptop, text on screen, brand logos, cartoon.

> Код поверх клипа сохраняет «ШУМИТ?!», «РЕЖИМ BOEING» и экран зависания. Если хочешь оставить
> 3D-турбину, сделай клип короче: только человек до слова «самолёт» (~4 с).

---

## Клип 3 — сцена «Виновник найден» (14,05–20,6 с) → `clips/03-cleaning.mp4`, ≥ 7 с

**Prompt:**
> Extreme macro, vertical 9:16, inside a laptop cooling system: thick grey dust clogging copper heat
> sink fins and a small blower fan (device powered off), old dried cracked thermal paste on a CPU;
> technician's gloved hands remove the heatsink, wipe the old paste with isopropyl alcohol and a lint
> free cloth, apply a small dot of fresh grey thermal paste, clean the fan with a soft brush;
> lighting transitions from dirty warm orange to clean cool cyan-blue; ultra detailed, shallow depth
> of field, slow motion, premium tech commercial.

**Negative:** device turned on during cleaning, liquids on electronics, sparks, text, logos.

---

## Клип 4 — сцена «Не выбрасывай» (44,25–47,95 с) → `clips/09-dumpster.mp4`, ≥ 4 с

**Prompt:**
> Vertical 9:16 cinematic shot, a man in a hoodie stands next to a city waste container on a
> Warsaw residential street at dusk, holding an old laptop over the open bin, hesitating, about to
> drop it; slightly comedic dramatic framing, slow push-in, moody streetlights, graphite and blue
> grade. The action stops right before he lets go.

**Negative:** throwing violently, trash everywhere, text, logos.

> Стоп-кадр «СТОП!», обесцвечивание и перемотка делаются кодом поверх клипа.

---

## Опционально

- **Руки мастера и инструменты** для фона финальной заставки:
  > Macro of technician hands placing precision screwdrivers on a dark anti-static mat, soft blue light, vertical 9:16.
- **Фото Ярослава.** Если пришлёшь своё фото или видео, его можно поставить в финал вместо 3D-ПК.
  Придумывать лицо я не стану.
