import type { ThemeConfig } from '../types';

export const retroTheme: ThemeConfig = {
  shoot:     { type: 'square',   freqStart: 600,  freqEnd: 150,  duration: 0.10, gain: 0.35 },
  impact:    { type: 'square',   freqStart: 200,  freqEnd: 50,   duration: 0.15, gain: 0.5 },
  hit:       { type: 'square',   freqStart: 300,  freqEnd: 80,   duration: 0.08, gain: 0.3 },
  death:     { type: 'square',   freqStart: 0,    freqEnd: 0,    duration: 0.50, gain: 0.4, notes: [440, 330, 220, 110] },
  footstep:  { type: 'square',   freqStart: 120,  freqEnd: 80,   duration: 0.04, gain: 0.2 },
  jump:      { type: 'square',   freqStart: 150,  freqEnd: 500,  duration: 0.10, gain: 0.4 },
};
