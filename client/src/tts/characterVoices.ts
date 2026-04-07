// client/src/tts/characterVoices.ts
import type { TTSOptions } from "./tts";

// senderId (소켓 ID 등) → 캐릭터 음성 매핑
const voiceMap = new Map<string, TTSOptions>();

// 캐릭터 종류별 프리셋 정의
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

export function registerPlayerVoice(senderId: string, voiceId: string): void {
  const preset = VOICE_PRESETS[voiceId] || VOICE_PRESETS["default"];
  voiceMap.set(senderId, preset);
  console.log(`[TTS] Registered voice for ${senderId}: ${voiceId}`);
}

/**
 * 유저 ID를 기반으로 해당 유저의 TTS 설정을 가져옵니다.
 */
export function getVoiceOptions(senderId: string): TTSOptions {
  return voiceMap.get(senderId) || VOICE_PRESETS["default"];
}

/**
 * 유저 접속 종료 시 맵에서 제거합니다.
 */
export function unregisterPlayerVoice(senderId: string): void {
  voiceMap.delete(senderId);
}
