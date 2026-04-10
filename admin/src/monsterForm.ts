import { MonsterData, createMonster, updateMonster, uploadMonsterFile } from './monsterApi';

const defaultMonster = (): Omit<MonsterData, 'id'> => ({
  name: '',
  glbFile: '',
  hp: 100,
  speed: 3.0,
  scale: 1.0,
  isActive: true,
});

export const renderMonsterForm = (monster: MonsterData | null, onSaved: (savedMonster?: MonsterData) => void) => {
  const container = document.getElementById('monster-form-container')!;
  const data: Omit<MonsterData, 'id'> = monster ? { ...monster } : defaultMonster();

  container.innerHTML = `
    <div class="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <span class="px-3 py-1 bg-tertiary/10 text-tertiary text-[10px] rounded-full font-headline tracking-widest uppercase mb-1 inline-block">Monster lab</span>
        <h2 class="text-2xl font-headline font-bold text-primary tracking-tight">${monster ? '몬스터 설정 수정' : '신규 몬스터 제작'}</h2>
      </div>

      <div class="space-y-6 overflow-y-auto no-scrollbar max-h-[75vh] pr-1">
        <!-- Basic Info -->
        <div class="space-y-4 pt-2">
          <div class="space-y-2">
            <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">몬스터 이름</label>
            <input id="ms-name" type="text" maxlength="100" value="${data.name}" placeholder="예: 거대 슬라임, 지옥견..." 
              class="w-full bg-surface-container-high border-none rounded-xl py-4 px-5 focus:ring-2 focus:ring-primary text-sm font-semibold shadow-sm" />
          </div>
        </div>

        <!-- File Uploads -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">GLB 모델 파일</label>
            <div class="flex flex-col gap-2">
               <button id="ms-glb-btn" type="button" class="flex items-center justify-center gap-2 w-full py-4 bg-surface-container rounded-xl border-2 border-dashed border-primary/20 hover:border-primary/50 text-on-surface transition-all">
                  <span class="material-symbols-outlined text-xl">upload_file</span>
                  <span id="ms-glb-label" class="text-xs font-bold text-on-surface-variant truncate max-w-[150px]">${data.glbFile || '파일 선택 (.glb)'}</span>
               </button>
               <input id="ms-glb-input" type="file" accept=".glb" class="hidden" />
            </div>
          </div>
          <div class="space-y-2">
            <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">활성화 여부</label>
            <div class="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-white/50 h-[56px]">
              <span class="text-xs font-bold text-primary">Active</span>
              <label class="relative inline-flex items-center cursor-pointer">
                <input id="ms-active" type="checkbox" class="sr-only peer" ${data.isActive ? 'checked' : ''}>
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>

        <!-- Stats -->
        <div class="p-5 bg-surface-container rounded-2xl border border-white/40 space-y-6 shadow-inner">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-2">
              <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">초기 체력 (HP)</label>
              <input id="ms-hp" type="number" min="1" max="10000" value="${data.hp}" 
                class="w-full bg-surface-container-high border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-sm font-semibold shadow-sm" />
            </div>
            
            <div class="space-y-2">
              <div class="flex justify-between">
                <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">이동 속도</label>
                <span id="ms-speed-val" class="text-xs font-black text-primary">${data.speed.toFixed(1)}</span>
              </div>
              <input id="ms-speed" type="range" min="0.5" max="10.0" step="0.1" value="${data.speed}" class="w-full h-1.5 bg-background rounded-lg appearance-none cursor-pointer accent-primary" />
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex justify-between">
              <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">렌더링 스케일 (Scale)</label>
              <span id="ms-scale-val" class="text-xs font-black text-secondary">${data.scale.toFixed(2)}</span>
            </div>
            <input id="ms-scale" type="range" min="0.01" max="5.0" step="0.01" value="${data.scale}" class="w-full h-1.5 bg-background rounded-lg appearance-none cursor-pointer accent-secondary" />
          </div>
        </div>


        <!-- Sounds -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">이동 효과음</label>
            <div class="flex flex-col gap-2">
               <button id="ms-move-btn" type="button" class="flex items-center justify-center gap-2 w-full py-4 bg-surface-container rounded-xl border hover:border-secondary/50 text-on-surface transition-all">
                  <span class="material-symbols-outlined text-xl">footprint</span>
                  <span id="ms-move-label" class="text-[10px] font-bold text-on-surface-variant truncate max-w-[150px]">${data.moveSound || '선택 안함 (Web Audio)'}</span>
               </button>
               <input id="ms-move-input" type="file" accept=".mp3,.ogg,.wav" class="hidden" />
            </div>
          </div>
          <div class="space-y-2">
            <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">공격/울음 소리</label>
            <div class="flex flex-col gap-2">
               <button id="ms-attack-btn" type="button" class="flex items-center justify-center gap-2 w-full py-4 bg-surface-container rounded-xl border hover:border-secondary/50 text-on-surface transition-all">
                  <span class="material-symbols-outlined text-xl">campaign</span>
                  <span id="ms-attack-label" class="text-[10px] font-bold text-on-surface-variant truncate max-w-[150px]">${data.attackSound || '선택 안함'}</span>
               </button>
               <input id="ms-attack-input" type="file" accept=".mp3,.ogg,.wav" class="hidden" />
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-3 pt-4">
          <button id="ms-save-btn" class="flex-1 py-4 bg-gradient-to-br from-primary to-primary-container text-white rounded-2xl shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all font-headline font-bold text-sm">
            데이터 동기화
          </button>
          <button id="ms-cancel-btn" class="px-6 py-4 bg-surface-container-low text-on-surface-variant rounded-2xl border border-white/50 hover:bg-white transition-all font-headline font-semibold text-sm">
            취소
          </button>
        </div>
      </div>
    </div>
  `;

  // UI Event Handlers
  const speedInput = document.getElementById('ms-speed') as HTMLInputElement;
  const scaleInput = document.getElementById('ms-scale') as HTMLInputElement;

  speedInput.addEventListener('input', () => {
    document.getElementById('ms-speed-val')!.textContent = Number(speedInput.value).toFixed(1);
  });
  scaleInput.addEventListener('input', () => {
    document.getElementById('ms-scale-val')!.textContent = Number(scaleInput.value).toFixed(2);
  });


  // File Upload Handlers Helper
  const setupFileUpload = (btnId: string, inputId: string, labelId: string, field: keyof typeof data) => {
    const btn = document.getElementById(btnId)!;
    const input = document.getElementById(inputId) as HTMLInputElement;
    const label = document.getElementById(labelId)!;

    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      label.textContent = '업로드 중...';
      try {
        const filename = await uploadMonsterFile(file);
        (data as any)[field] = filename;
        label.textContent = filename;
        label.classList.add('text-primary');
      } catch (e) {
        alert('Upload failed.');
        label.textContent = '실패: ' + file.name;
      }
    });
  };

  setupFileUpload('ms-glb-btn', 'ms-glb-input', 'ms-glb-label', 'glbFile');
  setupFileUpload('ms-move-btn', 'ms-move-input', 'ms-move-label', 'moveSound');
  setupFileUpload('ms-attack-btn', 'ms-attack-input', 'ms-attack-label', 'attackSound');

  document.getElementById('ms-cancel-btn')!.addEventListener('click', () => {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-center p-12 opacity-50">
        <span class="material-symbols-outlined text-6xl mb-4 text-tertiary">monster</span>
        <p class="font-headline font-semibold text-lg">Select a monster to modify its characteristics</p>
      </div>
    `;
  });

  document.getElementById('ms-save-btn')!.addEventListener('click', async () => {
    const name = (document.getElementById('ms-name') as HTMLInputElement).value.trim();
    if (!name) { alert('이름을 입력하세요.'); return; }
    if (!data.glbFile) { alert('GLB 모델 파일을 업로드하세요.'); return; }

    const payload: Omit<MonsterData, 'id'> = {
      name,
      glbFile: data.glbFile,
      hp: Number((document.getElementById('ms-hp') as HTMLInputElement).value),
      speed: Number(speedInput.value),
      scale: Number(scaleInput.value),
      moveSound: data.moveSound || undefined,
      attackSound: data.attackSound || undefined,
      isActive: (document.getElementById('ms-active') as HTMLInputElement).checked,
    };

    try {
      let saved: MonsterData;
      if (monster?.id) {
        saved = await updateMonster(monster.id, payload);
      } else {
        saved = await createMonster(payload);
      }
      alert('저장되었습니다. 변경 사항을 게임에서 확인하려면 모든 플레이어가 해당 맵에서 퇴장했다가 다시 입장해야 합니다.');
      onSaved(saved);

    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  });
};
