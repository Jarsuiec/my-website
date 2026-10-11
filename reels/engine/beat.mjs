// Generates a simple royalty-free background beat (kick + hat + bass), 120 bpm.
// Usage: node reels/engine/beat.mjs out.mp3 [seconds]
import { spawnSync } from 'node:child_process';
const out = process.argv[2] || 'music.mp3', sec = process.argv[3] || 40;
const kick = 'sin(2*PI*t*(45+120*exp(-mod(t,0.5)*35)))*exp(-mod(t,0.5)*9)';
const hat = '(random(0)*2-1)*exp(-mod(t+0.25,0.5)*45)*0.18';
const bass = '0.22*sin(2*PI*t*if(lt(mod(t,4),2),55,49))*(1-exp(-mod(t,0.5)*20))*exp(-mod(t,0.5)*2)';
const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i',
  `aevalsrc='0.8*(${kick})+${hat}+${bass}':s=48000:d=${sec}`,
  '-af', 'lowpass=f=9000,aformat=channel_layouts=stereo,loudnorm=I=-16', '-b:a', '192k', out], { stdio: 'inherit' });
process.exit(r.status);
