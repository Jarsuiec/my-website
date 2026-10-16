import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import cut from './config/cut15.json';
import {COLORS} from './config/brand';
import {FPS, VOICE, f} from './config/timeline';
import {buildChunks} from './config/subs.js';
import {Film} from './Film';
import {SubtitleBox} from './components/overlays';
import {ramp} from './components/anim';

// Субтитры 15-секундной версии: те же реплики, переставленные на новые места.
const CHUNKS15 = buildChunks(
  cut.voice
    .filter((v) => v.subs)
    .map((v) => {
      const src = VOICE.find((x) => x.id === v.id)!;
      return {...src, start: v.at, words: src.words};
    })
);

export const Cut15: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const c = CHUNKS15.find((ch) => t >= ch.start && t < ch.end);
  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      {cut.segments.map((s) => (
        <Sequence key={s.name} from={f(s.dst)} durationInFrames={f(s.len)} name={s.name}>
          <Sequence from={-f(s.src)} layout="none">
            <Film subtitles={false} />
          </Sequence>
        </Sequence>
      ))}
      {c && <SubtitleBox text={c.text} t={t} start={c.start} end={c.end} />}
      <AbsoluteFill style={{background: '#000', opacity: ramp(t, cut.duration - 0.45, cut.duration)}} />
    </AbsoluteFill>
  );
};
