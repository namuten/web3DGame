# Sound System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 5가지 사운드 테마 SFX + 맵별 BGM을 가진 사운드 시스템을 게임에 통합한다.

**Architecture:** Howler.js로 BGM 파일을 재생하고, Web Audio API (Howler의 AudioContext 재활용)로 SFX를 합성한다. `soundManager.ts`가 유일한 사운드 진입점이며, 5가지 테마 파라미터 파일이 이를 구동한다. 캐릭터 선택 화면에서 테마를 고르고 localStorage에 저장한다. 맵별 BGM은 `MapConfig.bgmFile` 필드로 지정한다.

**Tech Stack:** TypeScript, Howler.js ^2.2.4, Web Audio API (native), Vite, Three.js (기존)

---

## File Map

| 파일 | 변경 종류 | 역할 |
|------|----------|------|
| `client/src/audio/types.ts` | 생성 | SoundTheme, ThemeConfig 타입 |
| `client/src/audio/themes/cute.ts` | 생성 | Cute 테마 파라미터 |
| `client/src/audio/themes/retro.ts` | 생성 | Retro 테마 파라미터 |
| `client/src/audio/themes/magic.ts` | 생성 | Magic 테마 파라미터 |
| `client/src/audio/themes/cyber.ts` | 생성 | Cyber 테마 파라미터 |
| `client/src/audio/themes/nature.ts` | 생성 | Nature 테마 파라미터 |
| `client/src/audio/soundManager.ts` | 생성 | 핵심 모듈 |
| `client/src/types/map.ts` | 수정 | `bgmFile?: string` 추가 |
| `client/src/ui/characterSelect.ts` | 수정 | 테마 선택 UI + `soundTheme` 반환 |
| `client/src/game/bullets.ts` | 수정 | playShoot, playImpact, playHit 연결 |
| `client/src/game/player.ts` | 수정 | playFootstep, playJump, playDeath 연결 |
| `client/src/game/monster.ts` | 수정 | playHit, playDeath 연결 |
| `client/src/main.ts` | 수정 | 테마 초기화 + playBGM 호출 |
| `client/public/sounds/bgm/.gitkeep` | 생성 | BGM 폴더 확보 |

---

## Task 1: Howler.js 설치 + 타입 정의

**Files:**
- Modify: `client/package.json` (npm install)
- Create: `client/src/audio/types.ts`

- [ ] **Step 1: Howler 설치**

```bash
cd client && npm install howler && npm install -D @types/howler
```

Expected output: `added N packages`

- [ ] **Step 2: `types.ts` 생성**

```typescript
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
```

- [ ] **Step 3: TypeScript 빌드 확인**

```bash
cd client && npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 4: 커밋**

```bash
cd client && git add package.json package-lock.json src/audio/types.ts
git commit -m "feat: add howler.js and sound system types"
```

---

## Task 2: 5가지 테마 파라미터 파일 생성

**Files:**
- Create: `client/src/audio/themes/cute.ts`
- Create: `client/src/audio/themes/retro.ts`
- Create: `client/src/audio/themes/magic.ts`
- Create: `client/src/audio/themes/cyber.ts`
- Create: `client/src/audio/themes/nature.ts`

- [ ] **Step 1: cute.ts 생성**

```typescript
// client/src/audio/themes/cute.ts
import type { ThemeConfig } from '../types';

export const cuteTheme: ThemeConfig = {
  shoot:     { type: 'sine',     freqStart: 800,  freqEnd: 200,  duration: 0.15, gain: 0.4 },
  impact:    { type: 'noise',    freqStart: 0,    freqEnd: 0,    duration: 0.20, gain: 0.5 },
  hit:       { type: 'square',   freqStart: 400,  freqEnd: 100,  duration: 0.10, gain: 0.3 },
  death:     { type: 'sine',     freqStart: 0,    freqEnd: 0,    duration: 0.40, gain: 0.4, notes: [523, 440, 349] }, // C5 A4 F4
  footstep:  { type: 'noise',    freqStart: 0,    freqEnd: 0,    duration: 0.05, gain: 0.15 },
  jump:      { type: 'sine',     freqStart: 200,  freqEnd: 600,  duration: 0.12, gain: 0.4 },
};
```

- [ ] **Step 2: retro.ts 생성**

```typescript
// client/src/audio/themes/retro.ts
import type { ThemeConfig } from '../types';

export const retroTheme: ThemeConfig = {
  shoot:     { type: 'square',   freqStart: 600,  freqEnd: 150,  duration: 0.10, gain: 0.35 },
  impact:    { type: 'square',   freqStart: 200,  freqEnd: 50,   duration: 0.15, gain: 0.5 },
  hit:       { type: 'square',   freqStart: 300,  freqEnd: 80,   duration: 0.08, gain: 0.3 },
  death:     { type: 'square',   freqStart: 0,    freqEnd: 0,    duration: 0.50, gain: 0.4, notes: [440, 330, 220, 110] },
  footstep:  { type: 'square',   freqStart: 120,  freqEnd: 80,   duration: 0.04, gain: 0.2 },
  jump:      { type: 'square',   freqStart: 150,  freqEnd: 500,  duration: 0.10, gain: 0.4 },
};
```

- [ ] **Step 3: magic.ts 생성**

```typescript
// client/src/audio/themes/magic.ts
import type { ThemeConfig } from '../types';

export const magicTheme: ThemeConfig = {
  shoot:     { type: 'sine',     freqStart: 1200, freqEnd: 600,  duration: 0.25, gain: 0.35 },
  impact:    { type: 'sine',     freqStart: 900,  freqEnd: 200,  duration: 0.35, gain: 0.45 },
  hit:       { type: 'triangle', freqStart: 700,  freqEnd: 200,  duration: 0.20, gain: 0.3 },
  death:     { type: 'sine',     freqStart: 0,    freqEnd: 0,    duration: 0.60, gain: 0.4, notes: [880, 660, 440, 220] },
  footstep:  { type: 'triangle', freqStart: 300,  freqEnd: 200,  duration: 0.08, gain: 0.12 },
  jump:      { type: 'sine',     freqStart: 400,  freqEnd: 1200, duration: 0.20, gain: 0.4 },
};
```

- [ ] **Step 4: cyber.ts 생성**

```typescript
// client/src/audio/themes/cyber.ts
import type { ThemeConfig } from '../types';

export const cyberTheme: ThemeConfig = {
  shoot:     { type: 'sawtooth', freqStart: 500,  freqEnd: 100,  duration: 0.12, gain: 0.35 },
  impact:    { type: 'sawtooth', freqStart: 300,  freqEnd: 60,   duration: 0.18, gain: 0.5 },
  hit:       { type: 'sawtooth', freqStart: 400,  freqEnd: 80,   duration: 0.10, gain: 0.3 },
  death:     { type: 'sawtooth', freqStart: 0,    freqEnd: 0,    duration: 0.45, gain: 0.4, notes: [330, 250, 180, 90] },
  footstep:  { type: 'sawtooth', freqStart: 150,  freqEnd: 100,  duration: 0.04, gain: 0.15 },
  jump:      { type: 'sawtooth', freqStart: 180,  freqEnd: 550,  duration: 0.12, gain: 0.4 },
};
```

- [ ] **Step 5: nature.ts 생성**

```typescript
// client/src/audio/themes/nature.ts
import type { ThemeConfig } from '../types';

export const natureTheme: ThemeConfig = {
  shoot:     { type: 'noise',    freqStart: 0,    freqEnd: 0,    duration: 0.12, gain: 0.3 },
  impact:    { type: 'noise',    freqStart: 0,    freqEnd: 0,    duration: 0.25, gain: 0.5 },
  hit:       { type: 'noise',    freqStart: 0,    freqEnd: 0,    duration: 0.10, gain: 0.25 },
  death:     { type: 'sine',     freqStart: 0,    freqEnd: 0,    duration: 0.50, gain: 0.35, notes: [293, 220, 165, 110] },
  footstep:  { type: 'noise',    freqStart: 0,    freqEnd: 0,    duration: 0.06, gain: 0.2 },
  jump:      { type: 'sine',     freqStart: 180,  freqEnd: 380,  duration: 0.15, gain: 0.3 },
};
```

- [ ] **Step 6: 빌드 확인**

```bash
cd client && npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 7: 커밋**

```bash
cd client && git add src/audio/themes/
git commit -m "feat: add 5 sound theme configs (cute/retro/magic/cyber/nature)"
```

---

## Task 3: soundManager 구현

**Files:**
- Create: `client/src/audio/soundManager.ts`

- [ ] **Step 1: soundManager.ts 생성**

```typescript
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
  Howler.ctx?.resume();
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
```

- [ ] **Step 2: BGM 폴더 생성**

```bash
mkdir -p client/public/sounds/bgm
touch client/public/sounds/bgm/.gitkeep
```

- [ ] **Step 3: 빌드 확인**

```bash
cd client && npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 4: 커밋**

```bash
cd client && git add src/audio/soundManager.ts public/sounds/
git commit -m "feat: implement soundManager with Web Audio synth and Howler BGM"
```

---

## Task 4: MapConfig에 bgmFile 추가

**Files:**
- Modify: `client/src/types/map.ts`

- [ ] **Step 1: MapConfig에 bgmFile 필드 추가**

`client/src/types/map.ts`를 다음과 같이 수정:

```typescript
export interface MapConfig {
  id: number;
  name: string;
  theme: string;
  floorSize: number;
  playZone: number;
  obstacleCount: number;
  obstacleColors: string[];
  fogDensity: number;
  bgColor: string;
  seed: number;
  bgmFile?: string;   // 추가: 맵별 BGM 파일명 (확장자 제외, public/sounds/bgm/ 기준)
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd client && npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
cd client && git add src/types/map.ts
git commit -m "feat: add bgmFile field to MapConfig"
```

---

## Task 5: CharacterSelection에 soundTheme 추가 + 선택 UI

**Files:**
- Modify: `client/src/ui/characterSelect.ts`

- [ ] **Step 1: `CharacterSelection` 인터페이스에 soundTheme 추가**

`characterSelect.ts` 파일의 `CharacterSelection` 인터페이스를 수정:

```typescript
export interface CharacterSelection {
  playerName: string;
  characterId: string;
  bodyColor: string;
  flowerColor: string;
  visorColor: string;
  flowerType: string;
  visorType: string;
  soundTheme: string;  // 추가
}
```

- [ ] **Step 2: 테마 선택 UI HTML 삽입**

`characterSelect.ts`의 `overlay.innerHTML` 내부, `start-btn` 버튼 바로 위에 아래 HTML 블록을 추가:

```html
<div style="margin-bottom:16px;text-align:left;">
  <div style="font-size:12px;color:#888;margin-bottom:8px;">🔊 사운드 테마</div>
  <div id="theme-btns" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
    <button data-theme="cute"   style="padding:6px 12px;border-radius:20px;border:2px solid #FFAFCC;background:#fff;cursor:pointer;font-family:monospace;font-size:12px;">🌸 귀여움</button>
    <button data-theme="retro"  style="padding:6px 12px;border-radius:20px;border:2px solid #ccc;background:#fff;cursor:pointer;font-family:monospace;font-size:12px;">👾 레트로</button>
    <button data-theme="magic"  style="padding:6px 12px;border-radius:20px;border:2px solid #ccc;background:#fff;cursor:pointer;font-family:monospace;font-size:12px;">✨ 마법</button>
    <button data-theme="cyber"  style="padding:6px 12px;border-radius:20px;border:2px solid #ccc;background:#fff;cursor:pointer;font-family:monospace;font-size:12px;">🤖 로봇</button>
    <button data-theme="nature" style="padding:6px 12px;border-radius:20px;border:2px solid #ccc;background:#fff;cursor:pointer;font-family:monospace;font-size:12px;">🌿 자연</button>
  </div>
</div>
```

- [ ] **Step 3: 테마 선택 로직 추가**

`startBtn.addEventListener('click', ...)` 블록 위에 다음 코드를 추가:

```typescript
import { soundManager } from '../audio/soundManager';
import type { SoundTheme } from '../audio/types';
```

(파일 상단 import에 추가)

그리고 `let selectedChar: CharacterData | null = null;` 아래에:

```typescript
// 사운드 테마 상태
const savedTheme = (localStorage.getItem('soundTheme') || 'cute') as SoundTheme;
soundManager.setTheme(savedTheme);
let selectedTheme: SoundTheme = savedTheme;

const updateThemeButtons = (active: SoundTheme) => {
  overlay.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach(btn => {
    const isActive = btn.dataset.theme === active;
    btn.style.borderColor = isActive ? '#FFAFCC' : '#ccc';
    btn.style.background  = isActive ? '#fff5f9' : '#fff';
    btn.style.fontWeight  = isActive ? 'bold' : 'normal';
  });
};

updateThemeButtons(savedTheme);

overlay.querySelector('#theme-btns')!.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('[data-theme]') as HTMLButtonElement | null;
  if (!btn) return;
  const theme = btn.dataset.theme as SoundTheme;
  selectedTheme = theme;
  soundManager.setTheme(theme);
  localStorage.setItem('soundTheme', theme);
  updateThemeButtons(theme);
  soundManager.playJump(); // 미리듣기
});
```

- [ ] **Step 4: resolve 시 soundTheme 포함**

`resolve({...})` 호출에 `soundTheme: selectedTheme` 추가:

```typescript
resolve({
  playerName: name,
  characterId: selectedChar!._id,
  bodyColor: selectedChar!.bodyColor,
  flowerColor: selectedChar!.flowerColor,
  visorColor: selectedChar!.visorColor,
  flowerType: selectedChar!.flowerType,
  visorType: selectedChar!.visorType || 'normal',
  soundTheme: selectedTheme,   // 추가
});
```

- [ ] **Step 5: 빌드 확인**

```bash
cd client && npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 6: 브라우저 수동 확인**

`npm run dev` 실행 후:
1. 캐릭터 선택 화면에 테마 버튼 5개 표시 확인
2. 버튼 클릭 시 미리듣기 소리 재생 확인
3. 선택된 버튼 하이라이트 확인
4. 새로고침 후 선택이 유지되는지 확인 (localStorage)

- [ ] **Step 7: 커밋**

```bash
cd client && git add src/ui/characterSelect.ts src/audio/
git commit -m "feat: add sound theme selector to character select screen"
```

---

## Task 6: main.ts에서 테마 + BGM 초기화

**Files:**
- Modify: `client/src/main.ts`

- [ ] **Step 1: soundManager import 추가**

`main.ts` 상단 import 블록에 추가:

```typescript
import { soundManager } from './audio/soundManager';
import type { SoundTheme } from './audio/types';
```

- [ ] **Step 2: 캐릭터 선택 후 테마 적용**

`showCharacterSelect().then((selection) => {` 블록 첫 줄에 추가:

```typescript
soundManager.setTheme(selection.soundTheme as SoundTheme);
```

- [ ] **Step 3: 맵 로드 시 BGM 재생**

`onMapConfig((config) => {` 블록 안, `initWorld(config);` 바로 아래에 추가:

```typescript
if (config.bgmFile) {
  soundManager.playBGM(config.bgmFile);
} else {
  soundManager.stopBGM();
}
```

- [ ] **Step 4: 빌드 확인**

```bash
cd client && npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 5: 커밋**

```bash
cd client && git add src/main.ts
git commit -m "feat: wire sound theme and map BGM in main.ts"
```

---

## Task 7: bullets.ts에 SFX 연결

**Files:**
- Modify: `client/src/game/bullets.ts`

- [ ] **Step 1: import 추가**

`bullets.ts` 상단에 추가:

```typescript
import { soundManager } from '../audio/soundManager';
```

- [ ] **Step 2: 발사 시 playShoot 호출**

`fireBullet` 함수 내, `const bullet = createBullet(...)` 바로 아래에 추가:

```typescript
soundManager.playShoot();
```

- [ ] **Step 3: 충돌 시 playImpact 호출**

`spawnImpact` 함수 첫 줄에 추가:

```typescript
soundManager.playImpact();
```

- [ ] **Step 4: 데미지 발생 시 playHit 호출**

`bullets.ts` 안에서 `_damageCallback(targetId, ...)` 가 호출되는 두 곳(레이캐스트 명중, 거리 기반 명중) 각각에서 콜백 호출 직전에 추가:

```typescript
soundManager.playHit();
```

(두 위치 모두 — 레이캐스트 히트와 보조 거리 기반 히트)

- [ ] **Step 5: 빌드 확인**

```bash
cd client && npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 6: 브라우저 수동 확인**

게임 실행 후:
1. 발사 시 "퓨!" 소리 확인
2. 충돌 시 "펑!" 소리 확인
3. 적 명중 시 "삐익" 소리 확인
4. 테마를 Retro로 바꾸면 8비트 느낌 소리로 바뀌는지 확인

- [ ] **Step 7: 커밋**

```bash
cd client && git add src/game/bullets.ts
git commit -m "feat: wire shoot/impact/hit SFX in bullets.ts"
```

---

## Task 8: player.ts에 SFX 연결

**Files:**
- Modify: `client/src/game/player.ts`

- [ ] **Step 1: import + footstep 타이머 변수 추가**

`player.ts` 상단 import 블록에 추가:

```typescript
import { soundManager } from '../audio/soundManager';
```

그리고 `const BASE_SPEED = 12;` 아래(모듈 레벨)에 추가:

```typescript
let _footstepTimer = 0;
```

- [ ] **Step 2: 점프 시 playJump 호출**

`player.ts:225` — `initPlayer` 내부의 keydown 리스너에서 점프 처리 블록을 찾아 수정:

```typescript
// 기존
if (hp > 0 && e.code === 'Space' && isOnGround) {
  verticalVelocity = JUMP_FORCE;
  isOnGround = false;
  modelScaleYVel = 1.5;
  e.preventDefault();
}

// 변경 후 (soundManager.playJump() 한 줄 추가)
if (hp > 0 && e.code === 'Space' && isOnGround) {
  verticalVelocity = JUMP_FORCE;
  isOnGround = false;
  modelScaleYVel = 1.5;
  soundManager.playJump();
  e.preventDefault();
}
```

- [ ] **Step 3: 걸음 소리 추가**

`player.ts:366` — `if (playerVelocity.lengthSq() > 0)` 블록 내부, `playerVelocity.normalize();` 바로 아래에 추가:

```typescript
// 걸음 소리 (0.35초 간격)
_footstepTimer -= deltaTime;
if (_footstepTimer <= 0 && isOnGround) {
  soundManager.playFootstep();
  _footstepTimer = 0.35;
}
```

- [ ] **Step 4: 피격/사망 시 SFX 호출**

`player.ts:569` — `applyDamage` 함수의 `if (isDamage)` 블록에 추가:

```typescript
// 기존
if (isDamage) {
  damageFlashTimer = 0.15;
  originalMaterials.clear();
  // ...

// 변경 후
if (isDamage) {
  if (hp <= 0) {
    soundManager.playDeath();
  } else {
    soundManager.playHit();
  }
  damageFlashTimer = 0.15;
  originalMaterials.clear();
  // ...
```

- [ ] **Step 5: 빌드 확인**

```bash
cd client && npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 6: 커밋**

```bash
cd client && git add src/game/player.ts
git commit -m "feat: wire jump/footstep/hit/death SFX in player.ts"
```

---

## Task 9: monster.ts에 SFX 연결

**Files:**
- Modify: `client/src/game/monster.ts`

- [ ] **Step 1: import 추가**

`monster.ts` 상단에 추가:

```typescript
import { soundManager } from '../audio/soundManager';
```

- [ ] **Step 2: 몬스터 피격 시 playHit 호출**

`monster.ts:183` — `MonsterManager.damage()` 메서드 첫 줄에 추가:

```typescript
// 기존
damage(_hp: number, maxHp: number, scale: number = 1.0) {
    if (!this.monsterMesh || !this.bodyMat) return;
    this.flashTimer = 0.2;

// 변경 후
damage(_hp: number, maxHp: number, scale: number = 1.0) {
    if (!this.monsterMesh || !this.bodyMat) return;
    if (_hp <= 0) {
      soundManager.playDeath();
    } else {
      soundManager.playHit();
    }
    this.flashTimer = 0.2;
```

- [ ] **Step 3: 빌드 확인**

```bash
cd client && npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 4: 커밋**

```bash
cd client && git add src/game/monster.ts
git commit -m "feat: wire hit/death SFX in monster.ts"
```

---

## Task 10: 최종 통합 확인

- [ ] **Step 1: 전체 빌드**

```bash
cd client && npm run build
```

Expected: 오류 없음, dist 폴더 생성

- [ ] **Step 2: 브라우저 통합 테스트**

`npm run dev` 실행 후 체크리스트:

1. 캐릭터 선택 화면에서 5가지 테마 버튼 표시
2. 테마 버튼 클릭 시 미리듣기 소리 재생 (처음 클릭 전엔 잠금 해제 필요)
3. 선택 후 게임 진입 → 이동 시 발걸음 소리
4. 스페이스바 점프 → 점프 소리
5. 발사 → 발사음
6. 벽/지형 충돌 → 충돌음
7. 몬스터/플레이어 맞출 때 → 피격음
8. 맵에 `bgmFile` 설정 시 BGM 재생 (서버 맵 설정 필요)
9. 테마를 바꾸면 소리 캐릭터가 달라짐

- [ ] **Step 3: 최종 커밋**

```bash
cd client && git add -A
git commit -m "feat: complete sound system integration"
```
