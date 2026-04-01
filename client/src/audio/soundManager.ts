// client/src/audio/soundManager.ts
import { Howl, Howler } from 'howler';
import type { SoundTheme, SoundEvent, SoundEventParams, ThemeConfig } from './types';
import { cuteTheme }   from './themes/cute';
import { retroTheme }  from './themes/retro';
import { magicTheme }  from './themes/magic';
import { cyberTheme }  from './themes/cyber';
import { natureTheme } from './themes/nature';

const THEMES: Record<SoundTheme, ThemeConfig> = {
  cute:   cuteTheme,
  retro:  retroTheme,
  magic:  magicTheme,
  cyber:  cyberTheme,
  nature: natureTheme,
};

// ─── AudioContext 잠금 해제 ─────────────────────────────────
let unlocked = false;
const unlockAudio = () => {
  if (unlocked) return;
  unlocked = true;
  (Howler.ctx as AudioContext)?.resume();
};
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown',     unlockAudio, { once: true });

// ─── 상태 ────────────────────────────────────────────────────
let currentTheme: SoundTheme = 'cute';
let masterVolume = 1.0;
let currentBGM: Howl | null = null;
let currentBGMFile = '';

// ─── Web Audio API 합성 헬퍼 ─────────────────────────────────

/** 화이트 노이즈 버퍼 생성 (한 번만) */
let _noiseBuffer: AudioBuffer | null = null;
const getNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
  if (_noiseBuffer) return _noiseBuffer;
  const frames = ctx.sampleRate * 0.5;
  _noiseBuffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = _noiseBuffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  return _noiseBuffer;
};

const synth = (params: SoundEventParams) => {
  const ctx = Howler.ctx as AudioContext;
  if (!ctx || ctx.state === 'suspended') return;

  const { type, freqStart, freqEnd, duration, gain } = params;
  const now = ctx.currentTime;
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(gain * masterVolume, now);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  gainNode.connect(ctx.destination);

  if (type === 'noise') {
    const source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx);
    source.connect(gainNode);
    source.start(now);
    source.stop(now + duration);
    return;
  }

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, now);
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);
  }
  osc.connect(gainNode);
  osc.start(now);
  osc.stop(now + duration);
};

/** death 이벤트: notes 배열을 순서대로 재생 */
const synthMelody = (params: SoundEventParams) => {
  const ctx = Howler.ctx as AudioContext;
  if (!ctx || ctx.state === 'suspended' || !params.notes?.length) return;

  const notes = params.notes;
  const noteDur = params.duration / notes.length;
  const now = ctx.currentTime;

  notes.forEach((freq, i) => {
    const start = now + i * noteDur;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(params.gain * masterVolume, start);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + noteDur);
    gainNode.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = params.type as OscillatorType;
    osc.frequency.setValueAtTime(freq, start);
    osc.connect(gainNode);
    osc.start(start);
    osc.stop(start + noteDur);
  });
};

// ─── 공개 API ─────────────────────────────────────────────────

export const soundManager = {
  setTheme(theme: SoundTheme) {
    currentTheme = theme;
  },

  getTheme(): SoundTheme {
    return currentTheme;
  },

  setVolume(vol: number) {
    masterVolume = Math.max(0, Math.min(1, vol));
    Howler.volume(masterVolume);
  },

  _play(event: SoundEvent) {
    const params = THEMES[currentTheme][event];
    if (params.notes?.length) {
      synthMelody(params);
    } else {
      synth(params);
    }
  },

  playShoot()    { this._play('shoot');    },
  playImpact()   { this._play('impact');   },
  playHit()      { this._play('hit');      },
  playDeath()    { this._play('death');    },
  playFootstep() { this._play('footstep'); },
  playJump()     { this._play('jump');     },

  playBGM(bgmFile: string) {
    if (!bgmFile) return;
    if (currentBGMFile === bgmFile && currentBGM) return;

    currentBGM?.stop();
    currentBGMFile = bgmFile;

    currentBGM = new Howl({
      src: [`/sounds/bgm/${bgmFile}.mp3`, `/sounds/bgm/${bgmFile}.ogg`],
      loop: true,
      volume: 0.4 * masterVolume,
      onloaderror: (_id, err) => console.warn('[BGM] load error:', err),
    });
    currentBGM.play();
  },

  stopBGM() {
    currentBGM?.stop();
    currentBGM = null;
    currentBGMFile = '';
  },
};
