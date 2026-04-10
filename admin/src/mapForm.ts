import { MapData, createMap, updateMap } from './mapApi';
import { Preview3D } from './preview3d';
import { stopBGM } from './mapList';

let preview: Preview3D | null = null;

const BGM_OPTIONS = [
  { value: '',              label: '(None)' },
  { value: 'bgm_lobby',    label: '🏠 Lobby' },
  { value: 'bgm_adventure',label: '⚔️ Adventure' },
  { value: 'bgm_nature',   label: '🌿 Nature' },
  { value: 'bgm_mystic',   label: '✨ Mystic' },
  { value: 'bgm_retro',    label: '👾 Retro' },
];

const defaultMap = (): Omit<MapData, 'id'> => ({
  name: '',
  theme: 'pastel',
  floorSize: 400,
  playZone: 80,
  obstacleCount: 80,
  obstacleColors: ['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF'],
  fogDensity: 0.005,
  bgColor: '#A2D2FF',
  seed: 42,
  isActive: true,
  bgmFile: '',
});

const randomSeed = () => Math.floor(Math.random() * 2147483647);

export const renderMapForm = (map: MapData | null, onSaved: (savedMap?: MapData) => void) => {
  stopBGM();
  const container = document.getElementById('map-form-container')!;
  const data: Omit<MapData, 'id'> = map ? { ...map } : defaultMap();
  let colors: string[] = [...data.obstacleColors];

  const renderColorList = () => {
    const el = document.getElementById('color-list')!;
    if (!el) return;
    el.innerHTML = '';
    colors.forEach((c, i) => {
      const row = document.createElement('div');
      row.className = 'group flex items-center gap-2 p-1.5 bg-surface-container rounded-lg border border-white/40 shadow-sm';
      
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.value = c;
      picker.className = 'w-6 h-6 rounded cursor-pointer border-none bg-transparent';
      picker.addEventListener('input', () => { colors[i] = picker.value; updatePreview(); });
      
      const removeBtn = document.createElement('button');
      removeBtn.innerHTML = '<span class="material-symbols-outlined text-sm">close</span>';
      removeBtn.type = 'button';
      removeBtn.className = 'w-6 h-6 flex items-center justify-center text-error opacity-0 group-hover:opacity-100 transition-opacity hover:bg-error/10 rounded-md';
      removeBtn.addEventListener('click', () => { colors.splice(i, 1); renderColorList(); updatePreview(); });
      
      row.appendChild(picker);
      row.appendChild(removeBtn);
      el.appendChild(row);
    });
  };

  container.innerHTML = `
    <div class="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div class="flex items-center justify-between">
        <div>
          <span class="px-3 py-1 bg-secondary/10 text-secondary text-[10px] rounded-full font-headline tracking-widest uppercase mb-1 inline-block">Map Studio</span>
          <h2 class="text-2xl font-headline font-bold text-primary tracking-tight">${map ? '맵 정보 수정' : '새 맵 생성'}</h2>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <!-- Map Preview Column -->
        <div class="relative group">
          <div class="absolute -top-10 -right-10 w-40 h-40 bg-secondary-container/20 rounded-full blur-3xl opacity-60"></div>
          <div class="relative w-full aspect-square rounded-2xl bg-surface-container-low overflow-hidden shadow-inner border border-white/40">
            <canvas id="map-preview-canvas" class="w-full h-full outline-none" tabindex="0"></canvas>
            <div class="absolute bottom-4 left-4 right-4 glass-panel rounded-xl p-3 flex justify-between items-center text-[10px] font-bold text-secondary uppercase tracking-widest pointer-events-none">
              <span>3D 미리보기</span>
              <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-secondary animate-ping"></span> Live</span>
            </div>
          </div>
        </div>

        <!-- Form Fields Column -->
        <div class="flex flex-col gap-6 overflow-y-auto no-scrollbar max-h-[70vh]">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">맵 이름</label>
              <input id="m-name" type="text" maxlength="100" value="${data.name}" placeholder="맵 이름을 입력하세요" 
                class="w-full bg-surface-container-high border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-sm font-semibold transition-all shadow-sm" />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">Aesthetic Theme</label>
              <select id="m-theme" class="w-full bg-surface-container-high border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-sm font-semibold transition-all cursor-pointer">
                <option value="pastel" ${data.theme === 'pastel' ? 'selected' : ''}>Pastel (파스텔)</option>
                <option value="candy"  ${data.theme === 'candy' ? 'selected' : ''}>Candy (사탕)</option>
                <option value="neon"   ${data.theme === 'neon' ? 'selected' : ''}>Neon (네온)</option>
                <option value="custom" ${data.theme === 'custom' ? 'selected' : ''}>Custom (사용자 정의)</option>
              </select>
            </div>
          </div>

          <div class="p-4 bg-surface-container rounded-xl border border-white/40 space-y-4 shadow-inner">
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">장애물 농도</label>
                <span id="obs-val" class="text-xs font-black text-primary">${data.obstacleCount}</span>
              </div>
              <input id="m-obs" type="range" min="10" max="200" value="${data.obstacleCount}" class="w-full h-1.5 bg-background rounded-lg appearance-none cursor-pointer accent-primary" />
            </div>

            <div class="space-y-2">
              <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">색상 팔레트</label>
              <div class="flex flex-wrap gap-2">
                 <div id="color-list" class="flex flex-wrap gap-2"></div>
                 <button type="button" id="add-color-btn" class="w-10 h-10 rounded-lg flex items-center justify-center bg-white border border-dashed border-primary/30 text-primary hover:bg-primary/5 transition-all">
                  <span class="material-symbols-outlined text-sm">add</span>
                 </button>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
             <div class="space-y-2">
              <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">맵 전체 크기</label>
              <input id="m-floor" type="number" min="100" max="2000" value="${data.floorSize}" 
                class="w-full bg-surface-container-high border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-sm font-semibold shadow-sm" />
            </div>
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">활동 가능 영역</label>
                <span id="pz-val" class="text-xs font-black text-secondary">${data.playZone}</span>
              </div>
              <input id="m-pz" type="range" min="10" max="${Math.floor(data.floorSize / 2) - 10}" value="${data.playZone}" class="w-full h-1.5 bg-background rounded-lg appearance-none cursor-pointer accent-secondary" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">안개 밀도</label>
              <input id="m-fog" type="number" step="0.001" min="0.001" max="0.05" value="${data.fogDensity}" 
                class="w-full bg-surface-container-high border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-sm font-semibold shadow-sm" />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">배경색</label>
              <div class="flex gap-2">
                <input id="m-bg" type="color" value="${data.bgColor}" class="w-10 h-10 rounded-lg cursor-pointer border-none bg-transparent" />
                <span class="text-[10px] font-bold text-tertiary flex items-center">${data.bgColor.toUpperCase()}</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">고유 시드값</label>
              <div class="flex gap-2">
                <input id="m-seed" type="number" min="0" max="2147483647" value="${data.seed}" 
                  class="flex-1 bg-surface-container-high border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-xs font-mono shadow-sm" />
                <button type="button" id="rand-seed-btn" class="px-3 bg-surface-container-low text-primary rounded-xl hover:bg-white transition-all border border-white/50">
                  <span class="material-symbols-outlined text-lg">casino</span>
                </button>
              </div>
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-bold text-tertiary uppercase tracking-widest pl-1">배경 음악</label>
              <select id="m-bgm" class="w-full bg-surface-container-high border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-sm font-semibold transition-all cursor-pointer">
                ${BGM_OPTIONS.map(o => `<option value="${o.value}" ${(data.bgmFile || '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-white/50 shadow-sm mt-2">
            <div>
              <p class="text-xs font-bold text-primary">활성화 상태</p>
              <p class="text-[10px] text-tertiary uppercase tracking-widest">실제 게임 포탈에 표시 여부를 결정합니다</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input id="m-active" type="checkbox" class="sr-only peer" ${data.isActive ? 'checked' : ''}>
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div class="flex gap-3 mt-4">
            <button id="m-save-btn" class="flex-1 py-4 bg-gradient-to-br from-secondary to-secondary-container text-white rounded-2xl shadow-lg shadow-secondary/20 hover:shadow-secondary/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all font-headline font-bold text-sm flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-lg">map</span>
              설정 저장
            </button>
            <button id="m-cancel-btn" class="px-6 py-4 bg-surface-container-low text-on-surface-variant rounded-2xl border border-white/50 hover:bg-white transition-all font-headline font-semibold text-sm">
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // 3D 미리보기 초기화
  setTimeout(() => {
    const canvas = document.getElementById('map-preview-canvas') as HTMLCanvasElement;
    const parent = canvas.parentElement;
    if (!parent) return;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientWidth;
    if (preview) preview.destroy();
    preview = new Preview3D(canvas);
    preview.loadMap(data as any);
  }, 50);

  const updatePreview = () => {
    if (!preview) return;
    const payload = {
      name: 'Preview',
      theme: (document.getElementById('m-theme') as HTMLSelectElement).value,
      obstacleCount: Number((document.getElementById('m-obs') as HTMLInputElement).value),
      floorSize: Number((document.getElementById('m-floor') as HTMLInputElement).value),
      playZone: Number((document.getElementById('m-pz') as HTMLInputElement).value),
      fogDensity: Number((document.getElementById('m-fog') as HTMLInputElement).value),
      bgColor: (document.getElementById('m-bg') as HTMLInputElement).value,
      seed: Number((document.getElementById('m-seed') as HTMLInputElement).value),
      isActive: true,
      obstacleColors: colors,
    };
    preview.loadMap(payload as any);
  };

  renderColorList();

  document.getElementById('m-obs')!.addEventListener('input', (e) => {
    document.getElementById('obs-val')!.textContent = (e.target as HTMLInputElement).value;
    updatePreview();
  });

  document.getElementById('add-color-btn')!.addEventListener('click', () => {
    colors.push('#FFFFFF');
    renderColorList();
    updatePreview();
  });

  document.getElementById('rand-seed-btn')!.addEventListener('click', () => {
    (document.getElementById('m-seed') as HTMLInputElement).value = String(randomSeed());
    updatePreview();
  });

  const floorInput = document.getElementById('m-floor') as HTMLInputElement;
  const pzInput = document.getElementById('m-pz') as HTMLInputElement;
  floorInput.addEventListener('change', () => {
    const maxPZ = Math.max(10, Math.floor(Number(floorInput.value) / 2) - 10);
    pzInput.max = String(maxPZ);
    if (Number(pzInput.value) > maxPZ) pzInput.value = String(maxPZ);
    document.getElementById('pz-val')!.textContent = pzInput.value;
    updatePreview();
  });
  pzInput.addEventListener('input', () => {
    document.getElementById('pz-val')!.textContent = pzInput.value;
    updatePreview();
  });

  ['m-theme', 'm-fog', 'm-bg', 'm-seed'].forEach(id => {
    document.getElementById(id)!.addEventListener('input', updatePreview);
  });

  document.getElementById('m-cancel-btn')!.addEventListener('click', () => {
    stopBGM();
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-center p-12 opacity-50">
        <span class="material-symbols-outlined text-6xl mb-4 text-tertiary">map</span>
        <p class="font-headline font-semibold text-lg">Select a territory to inspect its properties</p>
      </div>
    `;
    if (preview) { preview.destroy(); preview = null; }
  });

  document.getElementById('m-save-btn')!.addEventListener('click', async () => {
    const name = (document.getElementById('m-name') as HTMLInputElement).value.trim();
    if (!name) { alert('Enter map name.'); return; }
    if (colors.length === 0) { alert('Define at least 1 color.'); return; }

    const bgmVal = (document.getElementById('m-bgm') as HTMLSelectElement).value;
    const payload: Omit<MapData, 'id'> = {
      name,
      theme: (document.getElementById('m-theme') as HTMLSelectElement).value,
      obstacleCount: Number((document.getElementById('m-obs') as HTMLInputElement).value),
      floorSize: Number((document.getElementById('m-floor') as HTMLInputElement).value),
      playZone: Number((document.getElementById('m-pz') as HTMLInputElement).value),
      fogDensity: Number((document.getElementById('m-fog') as HTMLInputElement).value),
      bgColor: (document.getElementById('m-bg') as HTMLInputElement).value,
      seed: Number((document.getElementById('m-seed') as HTMLInputElement).value),
      isActive: (document.getElementById('m-active') as HTMLInputElement).checked,
      obstacleColors: colors,
      bgmFile: bgmVal || undefined,
    };

    try {
      let savedResult: MapData;
      if (map?.id) {
        savedResult = await updateMap(map.id, payload);
      } else {
        savedResult = await createMap(payload);
      }
      alert('Saved.');
      onSaved(savedResult);
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  });
};
