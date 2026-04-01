import * as THREE from 'three';
import { createCharacterModel } from '../game/characterModel';
import { toThreeColor } from '../utils';
import { soundManager } from '../audio/soundManager';
import type { SoundTheme } from '../audio/types';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://namuten.duckdns.org';

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

interface CharacterData {
  _id: string;
  name: string;
  description?: string;
  bodyColor: string;
  flowerColor: string;
  visorColor: string;
  flowerType: string;
  visorType?: string;
}

export const renderSnapshot = (char: { bodyColor: string; flowerColor: string; visorColor: string; flowerType: string; visorType?: string }): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(160, 160);
    renderer.setClearColor(0xA2D2FF);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xA2D2FF);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9f3fc, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(5, 10, 5);
    scene.add(dir);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 2.5, 4);
    camera.lookAt(0, 1, 0);

    const model = createCharacterModel(toThreeColor(char.bodyColor), toThreeColor(char.flowerColor), char.flowerType, char.visorType || 'normal');
    if ((model as any).setVisorColor) (model as any).setVisorColor(toThreeColor(char.visorColor));
    model.position.set(0, -0.5, 0);
    scene.add(model);

    renderer.render(scene, camera);
    const dataUrl = canvas.toDataURL('image/png');
    renderer.dispose();
    resolve(dataUrl);
  });
};

export const showCharacterSelect = (): Promise<CharacterSelection> => {
  return new Promise(async (resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0;
      background: linear-gradient(135deg, #A2D2FF 0%, #BDE0FE 50%, #FFAFCC 100%);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      z-index: 9999; font-family: monospace;
    `;

    overlay.innerHTML = `
      <div style="
        background: rgba(255,255,255,0.9);
        border-radius: 20px; padding: 36px 40px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.15);
        text-align: center; min-width: 400px; max-width: 700px;
      ">
        <div style="font-size:40px;margin-bottom:6px;">🌸</div>
        <h1 style="margin:0 0 6px;font-size:22px;color:#333;">Web3D Game</h1>
        <p style="margin:0 0 20px;font-size:13px;color:#888;">이름을 입력하고 캐릭터를 선택해주세요</p>
        <input id="name-input" type="text" maxlength="12" placeholder="이름 (최대 12자)"
          style="width:100%;box-sizing:border-box;padding:10px 14px;font-size:15px;
          font-family:monospace;border:2px solid #FFAFCC;border-radius:10px;
          outline:none;text-align:center;color:#333;margin-bottom:20px;" />
        <div id="char-cards" style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-bottom:20px;"></div>
        <div id="empty-msg" style="display:none;color:#999;font-size:13px;padding:16px 0;">
          등록된 캐릭터가 없습니다. 관리자에게 문의하세요.
        </div>
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
        <button id="start-btn" disabled style="
          width:100%;padding:12px;font-size:16px;font-family:monospace;font-weight:bold;
          background:linear-gradient(135deg,#FFAFCC,#A2D2FF);
          border:none;border-radius:10px;cursor:pointer;color:#333;
          opacity:0.5;transition:opacity 0.2s;
        ">게임 시작 🚀</button>
      </div>
    `;
    document.body.appendChild(overlay);

    let selectedChar: CharacterData | null = null;

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

    const startBtn = overlay.querySelector('#start-btn') as HTMLButtonElement;
    const cardsEl = overlay.querySelector('#char-cards') as HTMLElement;
    const emptyMsg = overlay.querySelector('#empty-msg') as HTMLElement;

    const updateStartBtn = () => {
      const hasName = (overlay.querySelector('#name-input') as HTMLInputElement).value.trim().length > 0;
      const canStart = hasName && selectedChar !== null;
      startBtn.disabled = !canStart;
      startBtn.style.opacity = canStart ? '1' : '0.5';
    };

    overlay.querySelector('#name-input')!.addEventListener('input', updateStartBtn);

    // 캐릭터 목록 로드
    let characters: CharacterData[] = [];
    try {
      const res = await fetch(`${SERVER_URL}/api/characters`);
      characters = await res.json();
    } catch {
      characters = [];
    }

    if (characters.length === 0) {
      emptyMsg.style.display = 'block';
    } else {
      for (const char of characters) {
        const snapshot = await renderSnapshot(char);
        const card = document.createElement('div');
        card.style.cssText = `
          cursor:pointer; border-radius:12px; overflow:hidden;
          border:3px solid transparent; transition:border-color 0.2s;
          background:#fff; box-shadow:0 2px 8px rgba(0,0,0,0.1);
        `;
        card.innerHTML = `
          <img src="${snapshot}" style="width:100px;height:100px;display:block;" />
          <div style="padding:6px;font-size:12px;color:#333;text-align:center;">${char.name}</div>
        `;
        card.addEventListener('click', () => {
          cardsEl.querySelectorAll('div').forEach(c => (c as HTMLElement).style.borderColor = 'transparent');
          card.style.borderColor = '#4dabf7';
          selectedChar = char;
          updateStartBtn();
        });
        card.addEventListener('dblclick', () => {
          if (!startBtn.disabled) {
            startBtn.click();
          } else {
            const nameInput = overlay.querySelector('#name-input') as HTMLInputElement;
            if (!nameInput.value.trim().length) {
              nameInput.focus();
            }
          }
        });
        cardsEl.appendChild(card);
      }
    }

    startBtn.addEventListener('click', () => {
      const name = (overlay.querySelector('#name-input') as HTMLInputElement).value.trim() || '익명';
      if (!selectedChar) return;

      overlay.style.transition = 'opacity 0.4s';
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
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
      }, 400);
    });
  });
};
