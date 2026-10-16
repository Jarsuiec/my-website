import React from 'react';
import {Composition} from 'remotion';
import {Film} from './Film';
import {LookDev} from './LookDev';
import {Cut15} from './Cut15';
import {FPS, H, TOTAL_FRAMES, W} from './config/timeline';

export const Root: React.FC = () => (
  <>
    <Composition id="PCMaster" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} defaultProps={{subtitles: true}} />
    <Composition id="PCMaster15" component={Cut15} durationInFrames={15 * FPS} fps={FPS} width={W} height={H} />
    <Composition id="LookDev" component={LookDev} durationInFrames={8} fps={FPS} width={W} height={H} />
  </>
);
