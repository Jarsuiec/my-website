import tl from './timeline.json';
import voiceGen from '../generated/voice.json';

export const FPS = tl.fps;
export const W = tl.width;
export const H = tl.height;

export type SceneId = 'hook' | 'problem' | 'logo' | 'cooling' | 'ssd' | 'gaming' | 'remote' | 'trust' | 'final' | 'cta';

let acc = 0;
export const SCENES = tl.scenes.map((s) => {
  const out = {id: s.id as SceneId, start: acc, dur: s.dur};
  acc += s.dur;
  return out;
});
export const TOTAL_SEC = acc;
export const TOTAL_FRAMES = Math.round(acc * FPS);

export const scene = (id: SceneId) => SCENES.find((s) => s.id === id)!;
export const f = (sec: number) => Math.round(sec * FPS);

type GenLine = {start: number; dur: number; words?: {w: string; s: number; e: number}[]};
const gen = voiceGen as {source: string; lines: Record<string, GenLine>};
export const HAS_VOICE = gen.source !== 'none' && Object.keys(gen.lines).length > 0;

export type VoiceLine = {id: string; scene: SceneId; text: string; start: number; dur: number; words?: GenLine['words']};
export const VOICE: VoiceLine[] = tl.voice.map((v) => {
  const g = gen.lines[v.id];
  const start = g ? g.start : scene(v.scene as SceneId).start + v.at;
  return {id: v.id, scene: v.scene as SceneId, text: v.text, start, dur: g ? g.dur : v.est, words: g?.words};
});

export const SUBS_HIDDEN: string[] = tl.subtitles.hideInScenes;
export const CUES = tl.cues;
export const FOOTAGE = (tl as unknown as {footage?: {file: string | null; scene: string; at: number; dur: number; from?: number}}).footage;
