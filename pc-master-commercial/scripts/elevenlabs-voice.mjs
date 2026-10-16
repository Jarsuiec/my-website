// Озвучка твоим клоном голоса через официальный API ElevenLabs.
//
//   npm run voice -- --list          показать голоса в аккаунте (найти свой VOICE_ID)
//   npm run voice                    сгенерировать все 12 реплик, подогнать тайминг, записать субтитры
//
// Ключ и голос берутся ТОЛЬКО из переменных окружения или локального файла .env (он в .gitignore):
//   ELEVENLABS_API_KEY=...   ELEVENLABS_VOICE_ID=...   [ELEVENLABS_MODEL=eleven_multilingual_v2]
// Ключ никогда не попадает в код ролика и в репозиторий.
import fs from 'node:fs';
import path from 'node:path';
import {GEN_PATH, VOICE_DIR, duration, loadDotEnv, readTL, retime, saveTL, writeGen} from './voice-lib.mjs';

loadDotEnv();
const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE = process.env.ELEVENLABS_VOICE_ID;
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const API = 'https://api.elevenlabs.io/v1';
if (!KEY) {
  console.error('Нет ELEVENLABS_API_KEY. Создай файл .env (см. .env.example) или задай переменную окружения.');
  process.exit(1);
}

if (process.argv.includes('--list')) {
  const r = await fetch(`${API}/voices`, {headers: {'xi-api-key': KEY}});
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${await r.text()}`);
  const {voices} = await r.json();
  for (const v of voices) console.log(`${v.voice_id}  ${v.name}  [${v.category}]`);
  console.log('\nТвой клон обычно в категории "cloned" или "professional". Скопируй его id в ELEVENLABS_VOICE_ID.');
  process.exit(0);
}
if (!VOICE) {
  console.error('Нет ELEVENLABS_VOICE_ID. Выполни: npm run voice -- --list');
  process.exit(1);
}

// Настройки: естественно и уверенно, без театральности.
const settings = {stability: 0.5, similarity_boost: 0.85, style: 0.2, use_speaker_boost: true, speed: 1.0};

const tl = readTL();
fs.mkdirSync(VOICE_DIR, {recursive: true});
const lines = {};
const durs = {};
for (let i = 0; i < tl.voice.length; i++) {
  const v = tl.voice[i];
  const text = v.tts || v.text;
  const prev = tl.voice[i - 1];
  const next = tl.voice[i + 1];
  process.stdout.write(`${v.id}: ${text} … `);
  const r = await fetch(`${API}/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_192`, {
    method: 'POST',
    headers: {'xi-api-key': KEY, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: settings,
      // соседние фразы — для естественной интонации на стыках (ElevenLabs request stitching по тексту)
      previous_text: prev ? prev.tts || prev.text : undefined,
      next_text: next ? next.tts || next.text : undefined,
    }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const file = `${v.id}.mp3`;
  fs.writeFileSync(path.join(VOICE_DIR, file), Buffer.from(data.audio_base64, 'base64'));
  const d = duration(path.join(VOICE_DIR, file));
  // слова с таймингами — для точных субтитров
  let words;
  const al = data.alignment;
  if (al && al.characters) {
    words = [];
    let cur = null;
    al.characters.forEach((ch, k) => {
      if (/\s/.test(ch)) {
        if (cur) words.push(cur);
        cur = null;
      } else {
        if (!cur) cur = {w: '', s: al.character_start_times_seconds[k], e: 0};
        cur.w += ch;
        cur.e = al.character_end_times_seconds[k];
      }
    });
    if (cur) words.push(cur);
    // субтитры показывают text, озвучка — tts: если число слов разное, тайминг по словам не используем
    if (words.length !== v.text.split(/\s+/).length) words = undefined;
  }
  lines[v.id] = {dur: d, file, words};
  durs[v.id] = d;
  console.log(`${d.toFixed(2)} с (оценка была ${v.est} с)`);
}

const changes = retime(tl, durs);
for (const v of tl.voice) v.est = +durs[v.id].toFixed(2);
saveTL(tl);
writeGen(tl, 'elevenlabs', lines);
console.log('\nТайминг:', changes.length ? '\n  ' + changes.join('\n  ') : 'реплики помещаются в сцены без изменений');
console.log(`Записано: ${GEN_PATH}. Теперь: npm run build`);
