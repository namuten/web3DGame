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
  default:   { voice: "유나",    rate: 1.0,  pitch: 1.0,  lang: "ko-KR" },
};

/**
 * 특정 유저의 음성 설정을 등록합니다.
 */
export function registerPlayerVoice(senderId: string, flowerType: string): void {
  const preset = VOICE_PRESETS[flowerType] || VOICE_PRESETS["default"];
  voiceMap.set(senderId, preset);
  console.log(`[TTS] Registered voice for ${senderId}: ${flowerType}`);
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
