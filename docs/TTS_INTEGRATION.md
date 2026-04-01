# TTS 통합 가이드

## 개요

Web Speech API를 사용한 클라이언트 사이드 TTS 모듈.
서버 비용 없이 사용자 로컬 브라우저 음성으로 동작.

---

## 1. 파일 생성

### `client/src/tts/tts.ts`

```typescript
export interface TTSOptions {
  voice?: string;   // Web Speech API voice name (예: "Yuna", "유나")
  rate?: number;    // 0.1 ~ 10, 기본 1.0
  pitch?: number;   // 0 ~ 2, 기본 1.0
  lang?: string;    // "ko-KR" | "en-US" 등
}

interface QueueItem {
  text: string;
  options: TTSOptions;
}

class TTSManager {
  private queue: QueueItem[] = [];
  private speaking = false;
  private voices: SpeechSynthesisVoice[] = [];
  private ready = false;

  constructor() {
    if (!window.speechSynthesis) return;

    const load = () => {
      this.voices = speechSynthesis.getVoices();
      this.ready = true;
    };
    load();
    speechSynthesis.onvoiceschanged = load;
  }

  speak(text: string, options: TTSOptions = {}): void {
    if (!this.ready || !text.trim()) return;
    this.queue.push({ text, options });
    if (!this.speaking) this.processQueue();
  }

  stop(): void {
    this.queue = [];
    speechSynthesis.cancel();
    this.speaking = false;
  }

  private processQueue(): void {
    if (this.queue.length === 0) {
      this.speaking = false;
      return;
    }
    this.speaking = true;
    const { text, options } = this.queue.shift()!;

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang  = options.lang  ?? (this.isKorean(text) ? "ko-KR" : "en-US");
    utt.rate  = options.rate  ?? 1.0;
    utt.pitch = options.pitch ?? 1.0;

    const voice = this.findVoice(options.voice, utt.lang);
    if (voice) utt.voice = voice;

    utt.onend   = () => this.processQueue();
    utt.onerror = (e) => {
      if (e.error !== "interrupted" && e.error !== "canceled") {
        console.warn("[TTS] error:", e.error);
      }
      this.processQueue();
    };

    speechSynthesis.speak(utt);
  }

  private findVoice(name: string | undefined, lang: string): SpeechSynthesisVoice | null {
    if (name) {
      const exact = this.voices.find(v => v.name === name);
      if (exact) return exact;
    }
    // 언어 매칭 로컬 음성 우선
    const langVoices = this.voices.filter(v => v.lang.startsWith(lang.split("-")[0]));
    return langVoices.find(v => v.localService) ?? langVoices[0] ?? null;
  }

  private isKorean(text: string): boolean {
    return /[\uAC00-\uD7A3]/.test(text);
  }
}

export const tts = new TTSManager();
```

---

## 2. 캐릭터별 음성 매핑

### `client/src/tts/characterVoices.ts`

```typescript
import type { TTSOptions } from "./tts";

// macOS 기본 한국어 음성: 유나, Eddy, Flo, Grandma, Grandpa, Reed, Sandy, Shelley, Rocko
// 사용자 OS마다 사용 가능한 음성이 다르므로 fallback 포함

export interface CharacterVoiceConfig {
  voice: string;   // 선호 음성 이름
  rate: number;
  pitch: number;
  lang: string;
}

export const CHARACTER_VOICES: Record<string, CharacterVoiceConfig> = {
  // 예시 — 실제 캐릭터 ID에 맞게 수정
  warrior:  { voice: "Eddy",    rate: 0.9, pitch: 0.7, lang: "ko-KR" },
  mage:     { voice: "유나",    rate: 1.0, pitch: 1.2, lang: "ko-KR" },
  healer:   { voice: "Flo",     rate: 1.0, pitch: 1.3, lang: "ko-KR" },
  rogue:    { voice: "Reed",    rate: 1.1, pitch: 0.9, lang: "ko-KR" },
  elder:    { voice: "Grandpa", rate: 0.8, pitch: 0.6, lang: "ko-KR" },
  default:  { voice: "유나",    rate: 1.0, pitch: 1.0, lang: "ko-KR" },
};

export function getVoiceOptions(characterId: string): TTSOptions {
  return CHARACTER_VOICES[characterId] ?? CHARACTER_VOICES["default"];
}
```

---

## 3. 채팅 이벤트 연결

### 실제 메시지 타입

```typescript
interface ChatMessage {
  sender: string;    // 표시 이름
  senderId: string;  // 유저 ID
  text: string;
}
```

### `characterVoices.ts` 수정 — senderId 기반 매핑

```typescript
// client/src/tts/characterVoices.ts

import type { TTSOptions } from "./tts";

// senderId → 캐릭터 음성 매핑
// 게임 내 플레이어 목록을 받아올 때 함께 갱신
const voiceMap = new Map<string, TTSOptions>();

export function registerPlayerVoice(senderId: string, opts: TTSOptions): void {
  voiceMap.set(senderId, opts);
}

export function getVoiceOptions(senderId: string): TTSOptions {
  return voiceMap.get(senderId) ?? { voice: "유나", rate: 1.0, pitch: 1.0, lang: "ko-KR" };
}

// 캐릭터 종류별 프리셋 — 캐릭터 선택 시 registerPlayerVoice 호출
export const VOICE_PRESETS: Record<string, TTSOptions> = {
  warrior:  { voice: "Eddy",    rate: 0.9, pitch: 0.7, lang: "ko-KR" },
  mage:     { voice: "유나",    rate: 1.0, pitch: 1.2, lang: "ko-KR" },
  healer:   { voice: "Flo",     rate: 1.0, pitch: 1.3, lang: "ko-KR" },
  rogue:    { voice: "Reed",    rate: 1.1, pitch: 0.9, lang: "ko-KR" },
  elder:    { voice: "Grandpa", rate: 0.8, pitch: 0.6, lang: "ko-KR" },
};
```

### 플레이어 입장 시 음성 등록

```typescript
// 플레이어 목록을 받는 기존 이벤트에 추가
socket.on("room:players", (players: Player[]) => {
  players.forEach(p => {
    const preset = VOICE_PRESETS[p.characterType] ?? VOICE_PRESETS["mage"];
    registerPlayerVoice(p.senderId, preset);
  });
});
```

### 채팅 수신 이벤트에 TTS 추가

```typescript
// 기존 chat 이벤트 핸들러에 두 줄 추가

import { tts } from "../tts/tts";
import { getVoiceOptions } from "../tts/characterVoices";

socket.on("chat:message", (msg: ChatMessage) => {
  appendChatMessage(msg);  // 기존 채팅창 출력 로직

  // ↓ 추가
  const voiceOpts = getVoiceOptions(msg.senderId);
  tts.speak(msg.text, voiceOpts);
});
```

---

## 4. 서버 측 — 변경 없음

기존 `{ sender, senderId, text }` 그대로 사용. 서버 수정 불필요.

---

## 5. 음소거 / 볼륨 조절 UI (선택)

```typescript
// 음소거 토글
let muted = false;
muteBtn.addEventListener("click", () => {
  muted = !muted;
  if (muted) tts.stop();
});

// speak 호출 전 뮤트 체크
if (!muted) tts.speak(msg.text, voiceOpts);
```

---

## 6. 주의사항

| 항목 | 내용 |
|------|------|
| 브라우저 지원 | Chrome, Edge, Safari 지원 / Firefox 부분 지원 |
| 음성 가용성 | 사용자 OS에 설치된 음성만 사용 가능. 없으면 자동 fallback |
| 첫 상호작용 | 브라우저 정책상 첫 번째 speak()는 반드시 사용자 클릭 이후에 호출해야 함 |
| 큐 길이 | 메시지가 폭주할 경우 큐가 쌓임. 필요시 `queue.length > N` 이면 오래된 것 drop |

---

## 7. 빠른 테스트

브라우저 콘솔에서:
```javascript
import { tts } from "./src/tts/tts";
tts.speak("안녕하세요", { voice: "유나" });
```
