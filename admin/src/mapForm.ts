import { MapData, createMap, updateMap } from './mapApi';

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
});

const randomSeed = () => Math.floor(Math.random() * 2147483647);

export const renderMapForm = (map: MapData | null, onSaved: () => void) => {
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
      picker.addEventListener('input', () => { colors[i] = picker.value; });
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '−';
      removeBtn.type = 'button';
      removeBtn.addEventListener('click', () => { colors.splice(i, 1); renderColorList(); });
      row.appendChild(picker);
      row.appendChild(removeBtn);
      el.appendChild(row);
    });
  };

  container.innerHTML = `
    <h2 style="margin-bottom:20px;font-size:16px;">${map ? '맵 편집' : '새 맵'}</h2>
    <div class="fields-col" style="max-width:480px;">
      <div class="form-group">
        <label>맵 이름 *</label>
        <input id="m-name" type="text" maxlength="100" value="${data.name}" placeholder="맵 이름" />
      </div>
      <div class="form-group">
        <label>테마</label>
        <select id="m-theme">
          <option value="pastel" ${data.theme === 'pastel' ? 'selected' : ''}>Pastel</option>
          <option value="candy"  ${data.theme === 'candy'  ? 'selected' : ''}>Candy</option>
          <option value="neon"   ${data.theme === 'neon'   ? 'selected' : ''}>Neon</option>
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
        <label>활성 여부</label>
        <input id="m-active" type="checkbox" ${data.isActive ? 'checked' : ''} />
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button id="save-btn" style="flex:1;">저장</button>
        <button id="cancel-btn" style="flex:1;background:#666;">취소</button>
      </div>
    </div>
  `;

  renderColorList();

  document.getElementById('m-obs')!.addEventListener('input', (e) => {
    document.getElementById('obs-val')!.textContent = (e.target as HTMLInputElement).value;
  });

  document.getElementById('add-color-btn')!.addEventListener('click', () => {
    colors.push('#FFFFFF');
    renderColorList();
  });

  document.getElementById('rand-seed-btn')!.addEventListener('click', () => {
    (document.getElementById('m-seed') as HTMLInputElement).value = String(randomSeed());
  });

  // 실시간 플레이존 최대값 동기화
  const floorInput = document.getElementById('m-floor') as HTMLInputElement;
  const pzInput = document.getElementById('m-pz') as HTMLInputElement;
  floorInput.addEventListener('change', () => {
    const maxPZ = Math.max(10, Math.floor(Number(floorInput.value) / 2) - 10);
    pzInput.max = String(maxPZ);
    if (Number(pzInput.value) > maxPZ) pzInput.value = String(maxPZ);
    document.getElementById('pz-val')!.textContent = pzInput.value;
  });
  pzInput.addEventListener('input', () => {
    document.getElementById('pz-val')!.textContent = pzInput.value;
  });

  document.getElementById('cancel-btn')!.addEventListener('click', () => {
    container.innerHTML = '<p style="color:#888;">맵을 선택하거나 새 맵을 추가하세요.</p>';
  });

  document.getElementById('save-btn')!.addEventListener('click', async () => {
    const name = (document.getElementById('m-name') as HTMLInputElement).value.trim();
    if (!name) { alert('맵 이름을 입력하세요.'); return; }
    if (colors.length === 0) { alert('컬러 팔레트에 최소 1개 이상 입력하세요.'); return; }

    const payload: Omit<MapData, 'id'> = {
      name,
      theme:          (document.getElementById('m-theme')  as HTMLSelectElement).value,
      obstacleCount:  Number((document.getElementById('m-obs')   as HTMLInputElement).value),
      floorSize:      Number((document.getElementById('m-floor') as HTMLInputElement).value),
      playZone:       Number((document.getElementById('m-pz')    as HTMLInputElement).value),
      fogDensity:     Number((document.getElementById('m-fog')   as HTMLInputElement).value),
      bgColor:        (document.getElementById('m-bg')     as HTMLInputElement).value,
      seed:           Number((document.getElementById('m-seed')  as HTMLInputElement).value),
      isActive:       (document.getElementById('m-active') as HTMLInputElement).checked,
      obstacleColors: colors,
    };

    console.log('[MapForm] Saving payload:', payload);

    try {
      if (map?.id) {
        console.log('[MapForm] Updating existing map:', map.id);
        await updateMap(map.id, payload);
      } else {
        console.log('[MapForm] Creating new map');
        await createMap(payload);
      }
      alert('저장되었습니다.');
      container.innerHTML = '<p style="color:#888;">맵을 선택하거나 새 맵을 추가하세요.</p>';
      onSaved();
    } catch (e: any) {
      console.error('[MapForm] Save error:', e);
      alert('저장 실패: ' + e.message);
    }
  });
};
