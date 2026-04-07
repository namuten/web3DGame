// admin/src/voicePresets.ts
export interface TTSOptions {
  voice?: string;
  rate?: number;
  pitch?: number;
  lang?: string;
}

export const VOICE_PRESETS: Record<string, TTSOptions> = {
  daisy:     { voice: "유나",    rate: 1.0, pitch: 1.0, lang: "ko-KR" },
  rose:      { voice: "유나",    rate: 1.05, pitch: 1.25, lang: "ko-KR" },
  tulip:     { voice: "Eddy",    rate: 1.0,  pitch: 1.1,  lang: "ko-KR" },
  sunflower: { voice: "Reed",    rate: 1.1,  pitch: 0.95, lang: "ko-KR" },
  clover:    { voice: "Flo",     rate: 1.1,  pitch: 1.35, lang: "ko-KR" },
  giant:     { voice: "유나",    rate: 0.6,  pitch: 0.5,  lang: "ko-KR" },
  child:     { voice: "유나",    rate: 1.25, pitch: 1.8,  lang: "ko-KR" },
  ghost:     { voice: "유나",    rate: 0.7,  pitch: 0.2,  lang: "ko-KR" },
  default:   { voice: "유나",    rate: 1.0,  pitch: 1.0,  lang: "ko-KR" },
};
