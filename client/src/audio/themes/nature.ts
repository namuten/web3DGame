import type { ThemeConfig } from '../types';

export const natureTheme: ThemeConfig = {
  shoot:     { type: 'noise',    freqStart: 0,    freqEnd: 0,    duration: 0.12, gain: 0.3 },
  impact:    { type: 'noise',    freqStart: 0,    freqEnd: 0,    duration: 0.25, gain: 0.5 },
  hit:       { type: 'noise',    freqStart: 0,    freqEnd: 0,    duration: 0.10, gain: 0.25 },
  death:     { type: 'sine',     freqStart: 0,    freqEnd: 0,    duration: 0.50, gain: 0.35, notes: [293, 220, 165, 110] },
  footstep:  { type: 'noise',    freqStart: 0,    freqEnd: 0,    duration: 0.06, gain: 0.2 },
  jump:      { type: 'sine',     freqStart: 180,  freqEnd: 380,  duration: 0.15, gain: 0.3 },
};
