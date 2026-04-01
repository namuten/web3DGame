# Sound System Design

**Date:** 2026-04-01  
**Status:** Approved

## Overview

Add a complete sound system to the web3DGame client with:
- **5가지 사운드 테마** — 캐릭터 선택 화면에서 선택
- **맵별 BGM** — 맵 설정에서 지정
- **Web Audio API 합성 효과음** (테마별 파라미터 분리)
- **Howler.js BGM** (파일 기반, 맵별)

## Sound Themes

캐릭터 선택 화면(`characterSelect.ts`)에서 테마를 선택하고 저장. 게임 중 모든 SFX가 선택된 테마로 재생됨.

| # | 테마 | 스타일 | 키 |
|---|------|--------|-----|
| 1 | 귀여움 (Cute) | 뿅뿅, 팡팡 — 기본값 | `cute` |
| 2 | 레트로 (Retro) | 8비트 픽셀 사운드 | `retro` |
| 3 | 마법 (Magic) | 크리스탈, 마법봉 효과 | `magic` |
| 4 | 로봇 (Cyber) | 전자음, 기계적 느낌 | `cyber` |
| 5 | 자연 (Nature) | 나뭇잎, 돌, 흙 느낌 | `nature` |

## Architecture

### New Files

```
client/src/audio/
  soundManager.ts        ← 핵심 모듈 (SFX 합성 + BGM 관리)
  themes/
    cute.ts              ← 테마별 합성 파라미터
    retro.ts
    magic.ts
    cyber.ts
    nature.ts
  types.ts               ← SoundTheme, SoundEvent 타입 정의
```

### BGM Files (맵별)

```
client/public/sounds/
  bgm/
    map_<mapId>.mp3      ← 맵 ID별 BGM 파일
```

맵 설정(`MapConfig` 타입)에 `bgmFile?: string` 필드 추가. `soundManager.playBGM(mapId)` 호출 시 해당 파일 로드.

### soundManager API

```ts
// 테마
soundManager.setTheme(theme: SoundTheme)   // 'cute' | 'retro' | 'magic' | 'cyber' | 'nature'
soundManager.getTheme(): SoundTheme

// 효과음 (현재 테마로 재생)
soundManager.playShoot()       // 발사
soundManager.playImpact()      // 충돌
soundManager.playHit()         // 피해 입음
soundManager.playDeath()       // 사망
soundManager.playFootstep()    // 걸음
soundManager.playJump()        // 점프

// BGM (맵별)
soundManager.playBGM(mapId: string)   // 맵 BGM 시작
soundManager.stopBGM()               // BGM 중지

// 볼륨
soundManager.setVolume(0~1)
```

### 테마 파라미터 구조

```ts
// types.ts
export type SoundTheme = 'cute' | 'retro' | 'magic' | 'cyber' | 'nature';

export interface SoundEventParams {
  type: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';
  freqStart: number;
  freqEnd: number;
  duration: number;
  gain: number;
  notes?: number[];   // death 같은 멜로디 이벤트용
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

각 `themes/cute.ts` 등은 `ThemeConfig`를 export하고, `soundManager`가 현재 테마에 맞는 config를 선택해 합성.

## 테마별 합성 파라미터 (요약)

### Cute
| Event | Wave | Freq | Duration |
|-------|------|------|----------|
| Shoot | sine | 800→200Hz | 0.15s |
| Impact | noise | — | 0.20s |
| Hit | square | 400→100Hz | 0.10s |
| Death | sine | C5→A4→F4 | 0.40s |
| Footstep | noise | — | 0.05s |
| Jump | sine | 200→600Hz | 0.12s |

### Retro
8비트 느낌 — 사각파(square) 위주, 짧고 끊기는 느낌

### Magic
사인파 + 높은 주파수 트릴, 긴 리버브 시뮬레이션 (GainNode 느린 감쇠)

### Cyber
톱니파(sawtooth) + 비브라토, 전자음 느낌

### Nature
노이즈 + 낮은 주파수 필터링, 유기적인 질감

## Call Sites

| Caller | Methods |
|--------|---------|
| `bullets.ts` — `fireBullet()` | `playShoot()` |
| `bullets.ts` — `spawnImpact()` | `playImpact()` |
| `bullets.ts` — damage callback | `playHit()` |
| `player.ts` — move loop | `playFootstep()` |
| `player.ts` — jump | `playJump()` |
| `player.ts` / `monster.ts` — death | `playDeath()` |
| `main.ts` — 맵 로드 시 | `playBGM(mapId)` |

## 캐릭터 선택 화면 연동

`characterSelect.ts`에 사운드 테마 선택 UI 추가:
- 5개 버튼/드롭다운
- 선택 시 즉시 `playJump()` 미리듣기
- 선택값을 `localStorage`에 저장 → 게임 시작 시 `soundManager.setTheme()` 호출

## 맵 설정 연동

`types/map.ts`의 `MapConfig`에 `bgmFile?: string` 추가:
```ts
bgmFile: 'map_forest'   // public/sounds/bgm/map_forest.mp3
```
맵 로드 시 `soundManager.playBGM(config.bgmFile)` 호출.

## Autoplay Policy

첫 `pointerdown`/`keydown` 이벤트에서 `Howler.ctx.resume()` 호출로 AudioContext 잠금 해제. 이후 BGM 자동 시작.

## Future: 3D Spatial Audio

현재는 평면 스테레오. 나중에 각 `play*()` 메서드에 `position?: THREE.Vector3` 파라미터 추가 후 `PannerNode`로 처리 — 구조 변경 없이 확장 가능.

## Dependencies

```
howler        ^2.2.4
@types/howler ^2.2.x  (devDependency)
```
