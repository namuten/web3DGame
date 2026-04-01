// client/src/audio/types.ts
export type SoundTheme = 'cute' | 'retro' | 'magic' | 'cyber' | 'nature';

export type SoundEvent = 'shoot' | 'impact' | 'hit' | 'death' | 'footstep' | 'jump';

export interface SoundEventParams {
  type: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';
  freqStart: number;
  freqEnd: number;
  duration: number;
  gain: number;
  notes?: number[];   // death처럼 멜로디가 필요한 이벤트용 (Hz 배열)
}

export interface ThemeConfig {
  shoot: SoundEventParams;
  impact: SoundEventParams;
  hit: SoundEventParams;
  death: SoundEventParams;
  footstep: SoundEventParams;
  jump: SoundEventParams;
}
