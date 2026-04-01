import type { ThemeConfig } from '../types';

export const cuteTheme: ThemeConfig = {
  shoot:     { type: 'sine',     freqStart: 800,  freqEnd: 200,  duration: 0.15, gain: 0.4 },
  impact:    { type: 'noise',    freqStart: 0,    freqEnd: 0,    duration: 0.20, gain: 0.5 },
  hit:       { type: 'square',   freqStart: 400,  freqEnd: 100,  duration: 0.10, gain: 0.3 },
  death:     { type: 'sine',     freqStart: 0,    freqEnd: 0,    duration: 0.40, gain: 0.4, notes: [523, 440, 349] },
  footstep:  { type: 'noise',    freqStart: 0,    freqEnd: 0,    duration: 0.05, gain: 0.15 },
  jump:      { type: 'sine',     freqStart: 200,  freqEnd: 600,  duration: 0.12, gain: 0.4 },
};
