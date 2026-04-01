// client/src/tts/tts.ts

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
  private currentUtt: SpeechSynthesisUtterance | null = null; // 크롬 GC 방지용
  private watchdog: any = null;
  private resumeInterval: any = null; // 크롬 15초 버그 방지용
  private lastSpeakTimes = new Map<string, number>(); // 유저별 쿨다운 관리

  constructor() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      this.voices = window.speechSynthesis.getVoices();
      console.log(`[TTS] Voices loaded: ${this.voices.length} available.`);
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // 브라우저 잠금 해제 (User Gesture)
    const unlock = () => {
      const utt = new SpeechSynthesisUtterance("");
      utt.volume = 0;
      window.speechSynthesis.speak(utt);
      window.removeEventListener('pointerdown', unlock);
      console.log("[TTS] Audio unlocked via user gesture.");
    };
    window.addEventListener('pointerdown', unlock);
  }

  speak(text: string, options: TTSOptions = {}, senderId?: string): void {
    if (!text.trim()) return;

    // 쿨다운 체크 (1.5초 미만 연속 발화 방지)
    if (senderId) {
        const now = Date.now();
        const last = this.lastSpeakTimes.get(senderId) || 0;
        if (now - last < 1500) {
            console.log(`[TTS] Skipping spam message from ${senderId}`);
            return;
        }
        this.lastSpeakTimes.set(senderId, now);
    }
    
    // Voices가 아직 로드되지 않은 경우를 대비해 다시 확인
    if (this.voices.length === 0) {
      this.voices = window.speechSynthesis.getVoices();
    }

    console.log(`[TTS] Speaking: "${text.substring(0, 20)}..." (Queue: ${this.queue.length + 1})`);
    this.queue.push({ text, options });
    if (!this.speaking) this.processQueue();
  }

  stop(): void {
    this.queue = [];
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.speaking = false;
  }

  private processQueue(): void {
    if (this.queue.length === 0) {
      this.speaking = false;
      return;
    }

    // 브라우저가 일시 정지 상태라면 재개
    if (window.speechSynthesis.paused) {
      console.log("[TTS] Synthesis was paused, resuming...");
      window.speechSynthesis.resume();
    }

    this.speaking = true;
    const { text, options } = this.queue.shift()!;

    // 크롬 GC 방지를 위해 인스턴스에 할당
    this.currentUtt = new SpeechSynthesisUtterance(text);
    const utt = this.currentUtt;

    utt.lang = options.lang ?? (this.isKorean(text) ? "ko-KR" : "en-US");
    utt.rate = options.rate ?? 1.0;
    utt.pitch = options.pitch ?? 1.0;

    const voice = this.findVoice(options.voice, utt.lang);
    if (voice) {
      console.log(`[TTS] Using voice: ${voice.name} (${voice.lang})`);
      utt.voice = voice;
    } else {
      console.warn(`[TTS] No suitable voice found for ${utt.lang}, using default.`);
    }

    utt.onstart = () => {
      console.log("[TTS] Playback started.");
      if (this.watchdog) clearTimeout(this.watchdog);

      // 크롬은 15초 이상 유지되는 음성에 대해 일시 정지되는 버그가 있음
      // 지속적으로 resume()을 호출하여 깨워줌
      this.resumeInterval = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.resume();
        }
      }, 5000);
    };

    utt.onend = () => {
      console.log("[TTS] Playback ended.");
      this.clearStatus();
      this.processQueue();
    };

    utt.onerror = (e) => {
      console.warn("[TTS] Utterance error:", e.error);
      this.clearStatus();
      this.processQueue();
    };

    // 10초 내에 아무 반응 없으면 강제 다음 큐 (크롬 프리징 방지)
    this.watchdog = setTimeout(() => {
      console.warn("[TTS] Watchdog triggered - forcing next queue.");
      window.speechSynthesis.cancel();
      this.clearStatus();
      this.processQueue();
    }, 10000);

    // [근본 원인 해결] 크롬 내부 큐가 꼬여있을 수 있으므로 재생 전 강제 캔슬
    window.speechSynthesis.cancel();

    // 크롬 타이밍 이슈 방지를 위해 100ms 지연 후 실행
    setTimeout(() => {
      window.speechSynthesis.speak(utt);
      
      // [크롬 전용 심폐소생술] speak 호출 직후 pause/resume을 하면 멈춰있던 엔진이 깨어납니다.
      if (navigator.userAgent.includes("Chrome")) {
          window.speechSynthesis.pause();
          setTimeout(() => {
              window.speechSynthesis.resume();
          }, 10);
      }
    }, 100);
  }

  private clearStatus(): void {
    this.currentUtt = null;
    if (this.watchdog) {
      clearTimeout(this.watchdog);
      this.watchdog = null;
    }
    if (this.resumeInterval) {
      clearInterval(this.resumeInterval);
      this.resumeInterval = null;
    }
  }

  private findVoice(name: string | undefined, lang: string): SpeechSynthesisVoice | null {
    if (name) {
      const exact = this.voices.find(v => v.name === name);
      if (exact) return exact;
    }
    // 언어 매칭 (ko-KR 등)
    const langPrefix = lang.split("-")[0].toLowerCase();
    const langVoices = this.voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));

    // 1. 선호하는 이름이 포함된 음성 확인
    if (name) {
      const lowerName = name.toLowerCase();
      const fuzzyMatch = langVoices.find(v => v.name.toLowerCase().includes(lowerName) && v.localService);
      if (fuzzyMatch) return fuzzyMatch;
      
      const anyFuzzyMatch = langVoices.find(v => v.name.toLowerCase().includes(lowerName));
      if (anyFuzzyMatch) return anyFuzzyMatch;
    }

    // 2. 로컬 서비스 음성 우선 (네트워크 음성 방지)
    return langVoices.find(v => v.localService) ?? langVoices[0] ?? null;
  }

  private isKorean(text: string): boolean {
    return /[\uAC00-\uD7A3]/.test(text);
  }
}

export const tts = new TTSManager();
