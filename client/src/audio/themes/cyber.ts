import type { ThemeConfig } from '../types';

export const cyberTheme: ThemeConfig = {
  shoot:     { type: 'sawtooth', freqStart: 500,  freqEnd: 100,  duration: 0.12, gain: 0.35 },
  impact:    { type: 'sawtooth', freqStart: 300,  freqEnd: 60,   duration: 0.18, gain: 0.5 },
  hit:       { type: 'sawtooth', freqStart: 400,  freqEnd: 80,   duration: 0.10, gain: 0.3 },
  death:     { type: 'sawtooth', freqStart: 0,    freqEnd: 0,    duration: 0.45, gain: 0.4, notes: [330, 250, 180, 90] },
  footstep:  { type: 'sawtooth', freqStart: 150,  freqEnd: 100,  duration: 0.04, gain: 0.15 },
  jump:      { type: 'sawtooth', freqStart: 180,  freqEnd: 550,  duration: 0.12, gain: 0.4 },
};
