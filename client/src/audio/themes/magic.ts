import type { ThemeConfig } from '../types';

export const magicTheme: ThemeConfig = {
  shoot:     { type: 'sine',     freqStart: 1200, freqEnd: 600,  duration: 0.25, gain: 0.35 },
  impact:    { type: 'sine',     freqStart: 900,  freqEnd: 200,  duration: 0.35, gain: 0.45 },
  hit:       { type: 'triangle', freqStart: 700,  freqEnd: 200,  duration: 0.20, gain: 0.3 },
  death:     { type: 'sine',     freqStart: 0,    freqEnd: 0,    duration: 0.60, gain: 0.4, notes: [880, 660, 440, 220] },
  footstep:  { type: 'triangle', freqStart: 300,  freqEnd: 200,  duration: 0.08, gain: 0.12 },
  jump:      { type: 'sine',     freqStart: 400,  freqEnd: 1200, duration: 0.20, gain: 0.4 },
};
