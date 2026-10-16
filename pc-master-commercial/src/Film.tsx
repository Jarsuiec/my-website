import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {COLORS} from './config/brand';
import {FPS, SCENES, SceneId, f} from './config/timeline';
import {useFontsReady} from './components/fonts';
import {FilmLook, Subtitles} from './components/overlays';
import {S01Hook} from './scenes/S01Hook';
import {S02Problem} from './scenes/S02Problem';
import {S03Logo} from './scenes/S03Logo';
import {S04Cooling} from './scenes/S04Cooling';
import {S05SSD} from './scenes/S05SSD';
import {S06Gaming} from './scenes/S06Gaming';
import {S07Remote} from './scenes/S07Remote';
import {S08Trust} from './scenes/S08Trust';
import {S09Final} from './scenes/S09Final';
import {S10CTA} from './scenes/S10CTA';

const REGISTRY: Partial<Record<SceneId, React.FC<{dur: number}>>> = {
  hook: S01Hook,
  problem: S02Problem,
  logo: S03Logo,
  cooling: S04Cooling,
  ssd: S05SSD,
  gaming: S06Gaming,
  remote: S07Remote,
  trust: S08Trust,
  final: S09Final,
  cta: S10CTA,
};

// Основной фильм: сцены по таймингу из timeline.json + общий «плёночный» слой и субтитры.
export const Film: React.FC<{subtitles?: boolean}> = ({subtitles = true}) => {
  const ready = useFontsReady();
  const t = useCurrentFrame() / FPS;
  if (!ready) return <AbsoluteFill style={{background: COLORS.bg}} />;
  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      {SCENES.map((s) => {
        const C = REGISTRY[s.id];
        return (
          <Sequence key={s.id} from={f(s.start)} durationInFrames={f(s.dur)} name={s.id}>
            {C ? <C dur={s.dur} /> : <AbsoluteFill style={{background: COLORS.bg}} />}
          </Sequence>
        );
      })}
      <FilmLook t={t} />
      <Subtitles t={t} enabled={subtitles} />
    </AbsoluteFill>
  );
};
