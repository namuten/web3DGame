import { CharacterData, createCharacter, updateCharacter } from './api';
import { Preview3D } from './preview3d';
import { VOICE_PRESETS } from './voicePresets';

let preview: Preview3D | null = null;

const defaultChar = (): Omit<CharacterData, '_id'> => ({
  name: '',
  description: '',
  bodyColor: '#FFB7B2',
  flowerColor: '#FFB7B2',
  visorColor: '#333333',
  flowerType: 'daisy',
  visorType: 'normal',
  voiceId: 'default',
});

export const renderForm = (char: CharacterData | null, onSaved: () => void) => {
  const container = document.getElementById('form-container')!;
  const data = char ? { ...char } : defaultChar();

  container.innerHTML = `
    <div class="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div class="flex items-center justify-between">
        <div>
          <span class="px-3 py-1 bg-primary/10 text-primary text-[10px] rounded-full font-headline tracking-widest uppercase mb-1 inline-block">Specimen Info</span>
          <h2 class="text-2xl font-headline font-bold text-primary tracking-tight">${char ? '캐릭터 정보 수정' : '새 캐릭터 생성'}</h2>
        </div>
        ${char ? `<div class="text-right">
          <p class="text-[10px] font-bold text-tertiary uppercase tracking-tighter">고유 식별 ID</p>
          <p class="font-headline font-bold text-secondary text-sm">#${char._id?.slice(-6).toUpperCase()}</p>
        </div>` : ''}
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <!-- 3D Preview Column -->
        <div class="relative group">
          <div class="absolute -top-10 -left-10 w-40 h-40 bg-primary-container/20 rounded-full blur-3xl opacity-60"></div>
          <div class="relative w-full aspect-square rounded-2xl bg-surface-container-low overflow-hidden shadow-inner border border-white/40">
            <canvas id="preview-canvas" class="w-full h-full cursor-grab active:cursor-grabbing outline-none" tabindex="0"></canvas>
            <div class="absolute bottom-4 left-4 right-4 glass-panel rounded-xl p-3 flex justify-between items-center text-[10px] font-bold text-primary uppercase tracking-widest pointer-events-none">
              <span>3D 미리보기</span>
              <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span> Live</span>
            </div>
          </div>
        </div>

        <!-- Form Fields Column -->
        <div class="flex flex-col gap-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-xs font-bold text-tertiary uppercase tracking-widest pl-1">캐릭터 이름</label>
              <input id="f-name" type="text" maxlength="20" value="${data.name}" placeholder="이름을 입력하세요" 
                class="w-full bg-surface-container-high border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-sm font-semibold transition-all shadow-sm" />
            </div>
            <div class="space-y-2">
              <label class="text-xs font-bold text-tertiary uppercase tracking-widest pl-1">캐릭터 설명</label>
              <input id="f-desc" type="text" maxlength="100" value="${data.description || ''}" placeholder="간단한 설명을 입력하세요" 
                class="w-full bg-surface-container-high border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-sm transition-all shadow-sm" />
            </div>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">바디 색상</label>
              <div class="flex gap-2">
                <input id="f-body" type="color" value="${data.bodyColor}" class="w-10 h-10 rounded-lg cursor-pointer border-none bg-transparent flex-shrink-0" />
                <input id="f-body-text" type="text" value="${data.bodyColor}" maxlength="7" class="w-full bg-surface-container-high border-none rounded-lg text-[10px] font-bold text-center p-0 focus:ring-1 focus:ring-primary" />
              </div>
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">장식 색상</label>
              <div class="flex gap-2">
                <input id="f-flower" type="color" value="${data.flowerColor}" class="w-10 h-10 rounded-lg cursor-pointer border-none bg-transparent flex-shrink-0" />
                <input id="f-flower-text" type="text" value="${data.flowerColor}" maxlength="7" class="w-full bg-surface-container-high border-none rounded-lg text-[10px] font-bold text-center p-0 focus:ring-1 focus:ring-primary" />
              </div>
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">눈/안경 색상</label>
              <div class="flex gap-2">
                <input id="f-visor" type="color" value="${data.visorColor}" class="w-10 h-10 rounded-lg cursor-pointer border-none bg-transparent flex-shrink-0" />
                <input id="f-visor-text" type="text" value="${data.visorColor}" maxlength="7" class="w-full bg-surface-container-high border-none rounded-lg text-[10px] font-bold text-center p-0 focus:ring-1 focus:ring-primary" />
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-xs font-bold text-tertiary uppercase tracking-widest pl-1">머리 장식 종류</label>
              <select id="f-type" class="w-full bg-surface-container-high border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-sm font-semibold transition-all cursor-pointer">
                <option value="daisy" ${data.flowerType === 'daisy' ? 'selected' : ''}>Daisy (데이지)</option>
                <option value="rose" ${data.flowerType === 'rose' ? 'selected' : ''}>Rose (장미)</option>
                <option value="tulip" ${data.flowerType === 'tulip' ? 'selected' : ''}>Tulip (튤립)</option>
                <option value="sunflower" ${data.flowerType === 'sunflower' ? 'selected' : ''}>Sunflower (해바라기)</option>
                <option value="clover" ${data.flowerType === 'clover' ? 'selected' : ''}>Clover (네잎클로버)</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="text-xs font-bold text-tertiary uppercase tracking-widest pl-1">안경/눈 모양</label>
              <select id="f-visor-type" class="w-full bg-surface-container-high border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-sm font-semibold transition-all cursor-pointer">
                <option value="normal" ${data.visorType === 'normal' || !data.visorType ? 'selected' : ''}>Normal (일반)</option>
                <option value="glasses" ${data.visorType === 'glasses' ? 'selected' : ''}>Glasses (안경)</option>
                <option value="sunglasses" ${data.visorType === 'sunglasses' ? 'selected' : ''}>Sunglasses (선글라스)</option>
                <option value="star" ${data.visorType === 'star' ? 'selected' : ''}>Star (별 모양)</option>
                <option value="heart" ${data.visorType === 'heart' ? 'selected' : ''}>Heart (하트 모양)</option>
              </select>
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-xs font-bold text-tertiary uppercase tracking-widest pl-1">목소리 설정</label>
            <div class="flex gap-2">
              <select id="f-voice" class="flex-1 bg-surface-container-high border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-sm font-semibold transition-all cursor-pointer">
                <option value="default" ${data.voiceId === 'default' ? 'selected' : ''}>Default (기본)</option>
                <option value="daisy" ${data.voiceId === 'daisy' ? 'selected' : ''}>Daisy (나긋나긋)</option>
                <option value="rose" ${data.voiceId === 'rose' ? 'selected' : ''}>Rose (발랄함)</option>
                <option value="tulip" ${data.voiceId === 'tulip' ? 'selected' : ''}>Tulip (남성톤1)</option>
                <option value="sunflower" ${data.voiceId === 'sunflower' ? 'selected' : ''}>Sunflower (허스키)</option>
                <option value="clover" ${data.voiceId === 'clover' ? 'selected' : ''}>Clover (귀요미)</option>
                <option value="giant" ${data.voiceId === 'giant' ? 'selected' : ''}>Giant (거인)</option>
                <option value="child" ${data.voiceId === 'child' ? 'selected' : ''}>Child (어린이)</option>
                <option value="ghost" ${data.voiceId === 'ghost' ? 'selected' : ''}>Ghost (유령)</option>
              </select>
              <button id="listen-btn" class="px-4 bg-tertiary-container text-on-tertiary-container rounded-xl flex items-center justify-center hover:bg-tertiary-container/80 transition-all active:scale-95 shadow-sm">
                <span class="material-symbols-outlined">volume_up</span>
              </button>
            </div>
          </div>

          <div class="flex gap-3 mt-4">
            <button id="save-btn" class="flex-1 py-4 bg-gradient-to-br from-primary to-primary-container text-white rounded-2xl shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all font-headline font-bold text-sm flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-lg">auto_fix_high</span>
              설정 저장
            </button>
            <button id="cancel-btn" class="px-6 py-4 bg-surface-container-low text-on-surface-variant rounded-2xl border border-white/50 hover:bg-white transition-all font-headline font-semibold text-sm">
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // 3D 미리보기 초기화 (약간 지연시켜 부모 너비 계산 확실히 함)
  setTimeout(() => {
    const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
    const parent = canvas.parentElement;
    if (!parent) return;
    
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientWidth; // Square
    
    if (preview) preview.destroy();
    preview = new Preview3D(canvas);
    preview.loadCharacter(data.bodyColor, data.flowerColor, data.visorColor, data.flowerType || 'daisy', data.visorType || 'normal');
  }, 50);

  // 색상 입력 동기화 헬퍼
  const syncColor = (pickerId: string, textId: string, colorType: 'body' | 'flower' | 'visor') => {
    const picker = document.getElementById(pickerId) as HTMLInputElement;
    const text = document.getElementById(textId) as HTMLInputElement;

    picker.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      text.value = val;
      const fType = (document.getElementById('f-type') as HTMLSelectElement).value;
      const vType = (document.getElementById('f-visor-type') as HTMLSelectElement).value;
      preview?.updateColor(colorType, val, colorType === 'flower' ? fType : (colorType === 'visor' ? vType : undefined));
    });

    text.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        picker.value = val;
        const fType = (document.getElementById('f-type') as HTMLSelectElement).value;
        const vType = (document.getElementById('f-visor-type') as HTMLSelectElement).value;
        preview?.updateColor(colorType, val, colorType === 'flower' ? fType : (colorType === 'visor' ? vType : undefined));
      }
    });
  };

  syncColor('f-body', 'f-body-text', 'body');
  syncColor('f-flower', 'f-flower-text', 'flower');
  syncColor('f-visor', 'f-visor-text', 'visor');

  document.getElementById('f-type')!.addEventListener('change', (e) => {
    const type = (e.target as HTMLSelectElement).value;
    const color = (document.getElementById('f-flower') as HTMLInputElement).value;
    preview?.updateColor('flower', color, type);
  });

  document.getElementById('f-visor-type')!.addEventListener('change', (e) => {
    const type = (e.target as HTMLSelectElement).value;
    const color = (document.getElementById('f-visor') as HTMLInputElement).value;
    preview?.updateColor('visor', color, type);
  });

  // 목소리 들어보기
  document.getElementById('listen-btn')!.addEventListener('click', () => {
    const voiceId = (document.getElementById('f-voice') as HTMLSelectElement).value;
    const preset = VOICE_PRESETS[voiceId] || VOICE_PRESETS["default"];
    const charName = (document.getElementById('f-name') as HTMLInputElement).value.trim() || "캐릭터";
    const text = `안녕하세요! 제 이름은 ${charName}입니다. 현재 목소리 출력 테스트 중입니다. 가나다라마바사!`;

    if (!window.speechSynthesis) {
      alert("이 브라우저는 음성 합성을 지원하지 않습니다.");
      return;
    }

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = preset.rate || 1.0;
    utter.pitch = preset.pitch || 1.0;
    utter.lang = preset.lang || "ko-KR";

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes(preset.voice || ""));
    if (preferredVoice) {
      utter.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utter);
  });

  // 저장
  document.getElementById('save-btn')!.addEventListener('click', async () => {
    const payload: Omit<CharacterData, '_id'> = {
      name: (document.getElementById('f-name') as HTMLInputElement).value.trim(),
      description: (document.getElementById('f-desc') as HTMLInputElement).value.trim(),
      bodyColor: (document.getElementById('f-body') as HTMLInputElement).value,
      flowerColor: (document.getElementById('f-flower') as HTMLInputElement).value,
      visorColor: (document.getElementById('f-visor') as HTMLInputElement).value,
      flowerType: (document.getElementById('f-type') as HTMLSelectElement).value,
      visorType: (document.getElementById('f-visor-type') as HTMLSelectElement).value,
      voiceId: (document.getElementById('f-voice') as HTMLSelectElement).value,
    };

    if (!payload.name) { alert('이름을 입력해주세요.'); return; }

    try {
      if (char?._id) {
        await updateCharacter(char._id, payload);
      } else {
        await createCharacter(payload);
      }
      onSaved();
    } catch (err: any) {
      alert('저장 실패: ' + err.message);
    }
  });

  // 취소
  document.getElementById('cancel-btn')!.addEventListener('click', () => {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-center p-12 opacity-50">
        <span class="material-symbols-outlined text-6xl mb-4 text-tertiary">contact_support</span>
        <p class="font-headline font-semibold text-lg">Select a character or create a new one to begin</p>
      </div>
    `;
    if (preview) { preview.destroy(); preview = null; }
  });
};
