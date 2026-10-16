import {Config} from '@remotion/cli/config';

// Программный WebGL (SwiftShader через ANGLE) — работает без видеокарты.
Config.setChromiumOpenGlRenderer('swangle');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setConcurrency(2);
