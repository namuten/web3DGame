import { MapData, createMap, updateMap } from './mapApi';
import { Preview3D } from './preview3d';
import { stopBGM } from './mapList';

let preview: Preview3D | null = null;

const BGM_OPTIONS = [
  { value: '',              label: '(없음)' },
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
      row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;';
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.value = c;
      picker.addEventListener('input', () => { colors[i] = picker.value; updatePreview(); });
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '−';
      removeBtn.type = 'button';
      removeBtn.addEventListener('click', () => { colors.splice(i, 1); renderColorList(); updatePreview(); });
      row.appendChild(picker);
      row.appendChild(removeBtn);
      el.appendChild(row);
    });
  };

  container.innerHTML = `
    <div style="font-size:14px;font-weight:bold;margin-bottom:8px;">${map ? '맵 편집' : '새 맵'}</div>
    <div class="form-inner">
      <div class="preview-col">
        <canvas id="map-preview-canvas" tabindex="0"></canvas>
      </div>
      <div class="fields-col">
        <div class="form-group">
        <label>맵 이름 *</label>
        <input id="m-name" type="text" maxlength="100" value="${data.name}" placeholder="맵 이름" />
      </div>
      <div class="form-group">
        <label>테마</label>
        <select id="m-theme">
          <option value="pastel" ${data.theme === 'pastel' ? 'selected' : ''}>Pastel</option>
          <option value="candy"  ${data.theme === 'candy' ? 'selected' : ''}>Candy</option>
          <option value="neon"   ${data.theme === 'neon' ? 'selected' : ''}>Neon</option>
          <option value="custom" ${data.theme === 'custom' ? 'selected' : ''}>Custom</option>
        </select>
      </div>
      <div class="form-group">
        <label>장애물 수 (<span id="obs-val">${data.obstacleCount}</span>)</label>
        <input id="m-obs" type="range" min="10" max="200" value="${data.obstacleCount}" />
      </div>
      <div class="form-group">
        <label>컬러 팔레트 (최소 1개)</label>
        <div id="color-list"></div>
        <button type="button" id="add-color-btn" style="margin-top:4px;">+ 색상 추가</button>
      </div>
      <div class="form-group">
        <label>바닥 크기 (100~2000)</label>
        <input id="m-floor" type="number" min="100" max="2000" value="${data.floorSize}" />
      </div>
      <div class="form-group">
        <label>장애물 배치 구역 (<span id="pz-val">${data.playZone}</span>)</label>
        <input id="m-pz" type="range" min="10" max="${Math.floor(data.floorSize / 2) - 10}" value="${data.playZone}" />
      </div>
      <div class="form-group">
        <label>안개 밀도 (0.001~0.05)</label>
        <input id="m-fog" type="number" step="0.001" min="0.001" max="0.05" value="${data.fogDensity}" />
      </div>
      <div class="form-group">
        <label>배경색</label>
        <input id="m-bg" type="color" value="${data.bgColor}" />
      </div>
      <div class="form-group">
        <label>시드값 (0~2147483647)</label>
        <div style="display:flex;gap:6px;">
          <input id="m-seed" type="number" min="0" max="2147483647" value="${data.seed}" style="flex:1;" />
          <button type="button" id="rand-seed-btn">🎲 랜덤</button>
        </div>
      </div>
      <div class="form-group">
        <label>배경음악 (BGM)</label>
        <select id="m-bgm">
          ${BGM_OPTIONS.map(o => `<option value="${o.value}" ${(data.bgmFile || '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>활성 여부</label>
        <input id="m-active" type="checkbox" ${data.isActive ? 'checked' : ''} />
      </div>

      <div class="form-actions" style="display:flex;gap:8px;margin-top:16px;">
        <button id="m-save-btn" style="flex:1;">저장</button>
        <button id="m-cancel-btn" style="flex:1;background:#666;">취소</button>
      </div>
    </div>
  </div>
  `;

  // 3D 미리보기 초기화
  const canvas = document.getElementById('map-preview-canvas') as HTMLCanvasElement;
  const parent = canvas.parentElement;
  canvas.width = parent ? parent.clientWidth : 600;
  canvas.height = parent ? parent.clientHeight : 600;
  if (preview) preview.destroy();
  preview = new Preview3D(canvas);

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

  preview.loadMap(data as any);

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

  // 실시간 플레이존 최대값 동기화
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

  // 다른 필드들 변경 시 미리보기 업데이트
  ['m-theme', 'm-fog', 'm-bg', 'm-seed'].forEach(id => {
    document.getElementById(id)!.addEventListener('input', updatePreview);
  });

  document.getElementById('m-cancel-btn')!.addEventListener('click', () => {
    stopBGM();
    container.innerHTML = '<p style="color:#888;">맵을 선택하거나 새 맵을 추가하세요.</p>';
    if (preview) { preview.destroy(); preview = null; }
  });

  document.getElementById('m-save-btn')!.addEventListener('click', async () => {
    const name = (document.getElementById('m-name') as HTMLInputElement).value.trim();
    if (!name) { alert('맵 이름을 입력하세요.'); return; }
    if (colors.length === 0) { alert('컬러 팔레트에 최소 1개 이상 입력하세요.'); return; }

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

    console.log('[MapForm] Saving payload:', payload);

    try {
      let savedResult: MapData;
      if (map?.id) {
        console.log('[MapForm] Updating existing map:', map.id);
        savedResult = await updateMap(map.id, payload);
      } else {
        console.log('[MapForm] Creating new map');
        savedResult = await createMap(payload);
      }
      alert('저장되었습니다.');
      onSaved(savedResult);
    } catch (e: any) {
      console.error('[MapForm] Save error:', e);
      alert('저장 실패: ' + e.message);
    }
  });
};
