import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {COLORS} from '../config/brand';
import {HAS_VOICE, SUBS_HIDDEN, SCENES, VOICE} from '../config/timeline';
import {buildChunks} from '../config/subs.js';
import {clamp01, hash} from './anim';
import {FONT} from './fonts';

// Плёночное зерно + виньетка — объединяют все сцены в единую «плёнку».
export const FilmLook: React.FC<{t: number; grain?: number; vignette?: number}> = ({t, grain = 0.07, vignette = 0.55}) => {
  const noise = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const img = g.createImageData(256, 256);
    let s = 12345;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const v = s % 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL();
  }, []);
  const fr = Math.floor(t * 30);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill
        style={{
          backgroundImage: `url(${noise})`,
          backgroundSize: '256px 256px',
          backgroundPosition: `${Math.floor(hash(fr) * 256)}px ${Math.floor(hash(fr + 99) * 256)}px`,
          opacity: grain,
          mixBlendMode: 'overlay',
        }}
      />
      <AbsoluteFill style={{background: `radial-gradient(ellipse 75% 60% at 50% 48%, rgba(0,0,0,0) 55%, rgba(2,4,8,${vignette}) 100%)`}} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Субтитры: фраза делится на куски ≤ 2 строк; тайминг — по словам из ElevenLabs
// (если есть), иначе пропорционально числу символов.
// ---------------------------------------------------------------------------
const KEYWORDS = ['PC MASTER', 'SSD', 'Windows', 'термопаста', 'бюджет', 'диагностика', 'скорость', 'Телеграм', 'Ярослав', 'причину'];
export const CHUNKS = buildChunks(VOICE);

const renderWithKeywords = (text: string) => {
  const re = new RegExp(`(${KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return text.split(re).map((part, i) =>
    KEYWORDS.includes(part) ? (
      <span key={i} style={{color: COLORS.cyan}}>
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
};

export const sceneAt = (t: number) => SCENES.find((s) => t >= s.start && t < s.start + s.dur)?.id ?? 'cta';

export const SubtitleBox: React.FC<{text: string; t: number; start: number; end: number}> = ({text, t, start, end}) => {
  const k = clamp01((t - start) / 0.12);
  const ko = clamp01((end - t) / 0.1);
  return (
    <div style={{position: 'absolute', left: 140, right: 140, top: 1372, display: 'flex', justifyContent: 'center', opacity: Math.min(k, ko)}}>
      <div
        style={{
          fontFamily: FONT.text,
          fontWeight: 600,
          fontSize: 50,
          lineHeight: 1.22,
          color: COLORS.white,
          textAlign: 'center',
          padding: '12px 26px 14px',
          borderRadius: 18,
          background: 'rgba(4,8,14,0.55)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
          transform: `translateY(${(1 - k) * 10}px)`,
          textShadow: '0 2px 10px rgba(0,0,0,0.6)',
        }}
      >
        {renderWithKeywords(text)}
      </div>
    </div>
  );
};

export const Subtitles: React.FC<{t: number; enabled?: boolean}> = ({t, enabled = true}) => {
  if (!enabled) return null;
  if (SUBS_HIDDEN.includes(sceneAt(t))) return null;
  const c = CHUNKS.find((ch) => t >= ch.start && t < ch.end);
  if (!c) return null;
  return <SubtitleBox text={c.text} t={t} start={c.start} end={c.end} />;
};

export {HAS_VOICE};
