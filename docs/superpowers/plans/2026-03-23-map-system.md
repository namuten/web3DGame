# Map System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 어드민에서 맵을 DB로 관리하고, 게임 로비에서 플레이어가 맵(=방)을 선택해 입장하면 같은 맵 플레이어끼리 Socket.IO 룸으로 묶이는 시스템을 구축한다.

**Architecture:** 캐릭터 시스템과 동일한 패턴(Model → Route → Admin UI)으로 서버 측 맵 CRUD를 구성하고, 소켓 연결 후 클라이언트가 `JOIN_MAP`을 보내면 서버가 `MAP_CONFIG`(DB 값)로 응답, 클라이언트는 이 값으로 3D 맵을 동적 생성한다. 기존 전체 브로드캐스트를 `socket.to(mapId).emit`으로 교체해 룸 격리를 완성한다.

**Tech Stack:** Node.js/Express, Socket.IO, MySQL(mysql2/promise), Three.js, TypeScript, Vite

**Spec:** `docs/superpowers/specs/2026-03-23-map-system-design.md`

---

## 파일 구조 요약

| 파일 | 상태 | 역할 |
|------|------|------|
| `server/src/models/Map.ts` | 신규 | Map DB 모델 + ensureTable |
| `server/src/routes/maps.ts` | 신규 | REST CRUD API |
| `server/src/index.ts` | 수정 | 맵 라우트 등록 + Socket.IO 룸 시스템 |
| `admin/src/mapApi.ts` | 신규 | 어드민 맵 REST 클라이언트 |
| `admin/src/mapList.ts` | 신규 | 맵 목록 UI |
| `admin/src/mapForm.ts` | 신규 | 맵 생성/수정 폼 UI |
| `admin/src/main.ts` | 수정 | 맵 관리 탭 추가 |
| `client/src/types/map.ts` | 신규 | MapConfig 타입 정의 |
| `client/src/ui/lobby.ts` | 신규 | 맵 선택 로비 오버레이 |
| `client/src/game/world.ts` | 수정 | `initWorld(config)` 로 리팩터 |
| `client/src/network/socket.ts` | 수정 | JOIN_MAP / MAP_CONFIG / MAP_PLAYERS 이벤트 |
| `client/src/main.ts` | 수정 | 시작 흐름 재구성 |

---

## Task 1: Map 서버 모델 생성

**Files:**
- Create: `server/src/models/Map.ts`

참고 파일: `server/src/models/Character.ts` (동일 패턴)

- [ ] **Step 1: `server/src/models/Map.ts` 생성**

```typescript
import { pool } from '../db.js';

export interface GameMap {
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
  isActive: boolean;
  createdAt?: Date;
}

/** 테이블이 없으면 자동 생성 */
export const ensureTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS maps (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      name           VARCHAR(100) NOT NULL,
      theme          VARCHAR(50)  NOT NULL,
      floor_size     INT          DEFAULT 400,
      play_zone      INT          DEFAULT 80,
      obstacle_count INT          DEFAULT 80,
      obstacle_colors JSON        NOT NULL,
      fog_density    FLOAT        DEFAULT 0.005,
      bg_color       VARCHAR(7)   DEFAULT '#A2D2FF',
      seed           INT          DEFAULT 42,
      is_active      BOOLEAN      DEFAULT TRUE,
      created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
};

const rowToMap = (row: any): GameMap => ({
  id:             row.id,
  name:           row.name,
  theme:          row.theme,
  floorSize:      row.floor_size,
  playZone:       row.play_zone,
  obstacleCount:  row.obstacle_count,
  obstacleColors: typeof row.obstacle_colors === 'string'
    ? JSON.parse(row.obstacle_colors)
    : row.obstacle_colors,
  fogDensity:     row.fog_density,
  bgColor:        row.bg_color,
  seed:           row.seed,
  isActive:       Boolean(row.is_active),
  createdAt:      row.created_at,
});

export const findAllActive = async (): Promise<GameMap[]> => {
  const [rows] = await pool.execute(
    'SELECT * FROM maps WHERE is_active = TRUE ORDER BY created_at ASC'
  );
  return (rows as any[]).map(rowToMap);
};

export const findAll = async (): Promise<GameMap[]> => {
  const [rows] = await pool.execute('SELECT * FROM maps ORDER BY created_at ASC');
  return (rows as any[]).map(rowToMap);
};

export const findById = async (id: number): Promise<GameMap | null> => {
  const [rows] = await pool.execute('SELECT * FROM maps WHERE id = ?', [id]);
  const list = rows as any[];
  return list.length ? rowToMap(list[0]!) : null;
};

export const create = async (
  data: Omit<GameMap, 'id' | 'createdAt'>
): Promise<GameMap> => {
  const [result] = await pool.execute(
    `INSERT INTO maps (name, theme, floor_size, play_zone, obstacle_count,
      obstacle_colors, fog_density, bg_color, seed, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name, data.theme, data.floorSize, data.playZone, data.obstacleCount,
      JSON.stringify(data.obstacleColors), data.fogDensity, data.bgColor,
      data.seed, data.isActive,
    ]
  );
  const insertId = (result as any).insertId;
  return (await findById(insertId))!;
};

export const update = async (
  id: number,
  data: Partial<Omit<GameMap, 'id' | 'createdAt'>>
): Promise<GameMap | null> => {
  const colMap: Record<string, string> = {
    name: 'name', theme: 'theme', floorSize: 'floor_size',
    playZone: 'play_zone', obstacleCount: 'obstacle_count',
    obstacleColors: 'obstacle_colors', fogDensity: 'fog_density',
    bgColor: 'bg_color', seed: 'seed', isActive: 'is_active',
  };
  const fields = Object.keys(data) as (keyof typeof data)[];
  if (!fields.length) return findById(id);
  const set = fields.map(f => `${colMap[f]} = ?`).join(', ');
  const values = fields.map(f =>
    f === 'obstacleColors'
      ? JSON.stringify((data as any)[f])
      : (data as any)[f]
  );
  await pool.execute(`UPDATE maps SET ${set} WHERE id = ?`, [...values, id]);
  return findById(id);
};

/** 소프트 삭제: is_active = false */
export const deactivate = async (id: number): Promise<boolean> => {
  const [result] = await pool.execute(
    'UPDATE maps SET is_active = FALSE WHERE id = ?', [id]
  );
  return (result as any).affectedRows > 0;
};
```

- [ ] **Step 2: 빌드 확인**

```bash
cd server && npx tsc --noEmit
```
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add server/src/models/Map.ts
git commit -m "feat: add Map model with ensureTable"
```

---

## Task 2: 맵 REST API 라우트

**Files:**
- Create: `server/src/routes/maps.ts`

참고 파일: `server/src/routes/characters.ts`

- [ ] **Step 1: `server/src/routes/maps.ts` 생성**

```typescript
import { Router } from 'express';
import type { Request, Response } from 'express';
import * as MapModel from '../models/Map.js';

const router = Router();

// 활성 맵 목록 (게임 로비용)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const maps = await MapModel.findAllActive();
    res.json(maps);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch maps', message: err.message });
  }
});

// 전체 맵 목록 (어드민용)
router.get('/all', async (_req: Request, res: Response) => {
  try {
    const maps = await MapModel.findAll();
    res.json(maps);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch maps', message: err.message });
  }
});

// 단일 조회
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const map = await MapModel.findById(id);
    if (!map) return res.status(404).json({ error: 'Not found' });
    res.json(map);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch map', message: err.message });
  }
});

// 생성
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, theme, floorSize, playZone, obstacleCount,
            obstacleColors, fogDensity, bgColor, seed, isActive } = req.body;

    if (!name || !theme) {
      return res.status(400).json({ error: 'name and theme are required' });
    }
    if (!Array.isArray(obstacleColors) || obstacleColors.length === 0) {
      return res.status(400).json({ error: 'obstacleColors must be a non-empty array' });
    }
    if (seed !== undefined && (seed < 0 || seed > 2147483647)) {
      return res.status(400).json({ error: 'seed must be 0 ~ 2147483647' });
    }
    if (fogDensity !== undefined && (fogDensity < 0.001 || fogDensity > 0.05)) {
      return res.status(400).json({ error: 'fogDensity must be 0.001 ~ 0.05' });
    }

    const map = await MapModel.create({
      name,
      theme,
      floorSize:      floorSize      ?? 400,
      playZone:       playZone       ?? 80,
      obstacleCount:  obstacleCount  ?? 80,
      obstacleColors,
      fogDensity:     fogDensity     ?? 0.005,
      bgColor:        bgColor        ?? '#A2D2FF',
      seed:           seed           ?? 42,
      isActive:       isActive       ?? true,
    });
    res.status(201).json(map);
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to create map', message: err.message });
  }
});

// 수정
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { obstacleColors, seed } = req.body;

    if (obstacleColors !== undefined &&
        (!Array.isArray(obstacleColors) || obstacleColors.length === 0)) {
      return res.status(400).json({ error: 'obstacleColors must be a non-empty array' });
    }
    if (seed !== undefined && (seed < 0 || seed > 2147483647)) {
      return res.status(400).json({ error: 'seed must be 0 ~ 2147483647' });
    }
    if (fogDensity !== undefined && (fogDensity < 0.001 || fogDensity > 0.05)) {
      return res.status(400).json({ error: 'fogDensity must be 0.001 ~ 0.05' });
    }

    const map = await MapModel.update(id, req.body);
    if (!map) return res.status(404).json({ error: 'Not found' });
    res.json(map);
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to update map', message: err.message });
  }
});

// 소프트 삭제 (is_active = false)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const ok = await MapModel.deactivate(id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deactivated' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to deactivate map', message: err.message });
  }
});

export default router;
```

- [ ] **Step 2: `server/src/index.ts` 에 맵 라우트 및 ensureTable 등록**

`server/src/index.ts` 상단 import 추가:
```typescript
import { ensureTable as ensureMapTable } from './models/Map.js';
import mapRoutes from './routes/maps.js';
```

MySQL 연결 블록 (`pool.getConnection().then(...)`) 안의 기존 내용 **뒤에** 추가:
```typescript
// 기존 코드 (변경 없음):
    conn.release();
    await ensureTable();
    console.log('✅ characters 테이블 준비 완료');
// ↓ 아래에 추가:
    await ensureMapTable();
    console.log('✅ maps 테이블 준비 완료');
```

라우터 등록 (`app.use('/api/characters', characterRoutes);` 아래에 추가):
```typescript
app.use('/api/maps', mapRoutes);
```

- [ ] **Step 3: 서버 빌드 확인**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 4: 서버 시작 후 API 테스트**

```bash
# 서버 시작 (별도 터미널)
cd server && npm run dev

# maps 테이블 생성 확인 + 빈 목록 반환
curl http://220.85.41.214:3000/api/maps
# Expected: []

# 맵 생성 테스트
curl -X POST http://220.85.41.214:3000/api/maps \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","theme":"pastel","obstacleColors":["#FFADAD"]}'
# Expected: 201 with map object including id
```

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/maps.ts server/src/index.ts
git commit -m "feat: add maps REST API and register route"
```

---

## Task 3: 어드민 맵 API 클라이언트

**Files:**
- Create: `admin/src/mapApi.ts`

참고 파일: `admin/src/api.ts`

- [ ] **Step 1: `admin/src/mapApi.ts` 생성**

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://220.85.41.214:3000';
const BASE = `${API_URL}/api/maps`;

export interface MapData {
  id?: number;
  name: string;
  theme: string;
  floorSize: number;
  playZone: number;
  obstacleCount: number;
  obstacleColors: string[];
  fogDensity: number;
  bgColor: string;
  seed: number;
  isActive: boolean;
}

export const fetchMaps = async (): Promise<MapData[]> => {
  const res = await fetch(`${BASE}/all`);
  if (!res.ok) throw new Error('Failed to fetch maps');
  return res.json();
};

export const fetchMap = async (id: number): Promise<MapData> => {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error('Not found');
  return res.json();
};

export const createMap = async (data: Omit<MapData, 'id'>): Promise<MapData> => {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const updateMap = async (id: number, data: Partial<MapData>): Promise<MapData> => {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const deleteMap = async (id: number): Promise<void> => {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to deactivate');
};
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/mapApi.ts
git commit -m "feat: add admin map API client"
```

---

## Task 4: 어드민 맵 목록 UI

**Files:**
- Create: `admin/src/mapList.ts`

참고 파일: `admin/src/characterList.ts`

- [ ] **Step 1: `admin/src/mapList.ts` 생성**

```typescript
import { MapData, deleteMap } from './mapApi';

type OnSelect = (map: MapData) => void;
type OnNew = () => void;

export const renderMapList = (
  maps: MapData[],
  selectedId: number | null,
  onSelect: OnSelect,
  onNew: OnNew
) => {
  const listEl = document.getElementById('map-list')!;
  const addBtn = document.getElementById('map-add-btn')!;

  listEl.innerHTML = '';

  if (maps.length === 0) {
    listEl.innerHTML = '<div id="empty-state">맵이 없습니다</div>';
  }

  maps.forEach((map) => {
    const item = document.createElement('div');
    item.className = 'char-item' + (map.id === selectedId ? ' selected' : '');

    const dot = document.createElement('span');
    dot.style.cssText = `display:inline-block;width:12px;height:12px;border-radius:50%;background:${map.bgColor};margin-right:8px;flex-shrink:0;border:1px solid #ccc;`;

    const name = document.createElement('span');
    name.className = 'char-item-name';
    name.textContent = `${map.name} (${map.theme})`;

    const activeTag = document.createElement('span');
    activeTag.textContent = map.isActive ? '●' : '○';
    activeTag.style.cssText = `margin-left:6px;color:${map.isActive ? '#4caf50' : '#aaa'};font-size:11px;`;

    const nameWrapper = document.createElement('div');
    nameWrapper.style.display = 'flex';
    nameWrapper.style.alignItems = 'center';
    nameWrapper.appendChild(dot);
    nameWrapper.appendChild(name);
    nameWrapper.appendChild(activeTag);

    const actions = document.createElement('div');
    actions.className = 'char-item-actions';

    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️';
    editBtn.title = '편집';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect(map);
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑';
    delBtn.title = '비활성화';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`"${map.name}"을 비활성화할까요?`)) return;
      await deleteMap(map.id!);
      window.location.reload();
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    item.appendChild(nameWrapper);
    item.appendChild(actions);
    item.addEventListener('click', () => onSelect(map));
    listEl.appendChild(item);
  });

  addBtn.onclick = onNew;
};
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/mapList.ts
git commit -m "feat: add admin map list UI"
```

---

## Task 5: 어드민 맵 폼 UI

**Files:**
- Create: `admin/src/mapForm.ts`

참고 파일: `admin/src/characterForm.ts`

- [ ] **Step 1: `admin/src/mapForm.ts` 생성**

```typescript
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
        <label>바닥 크기</label>
        <input id="m-floor" type="number" min="100" max="1000" value="${data.floorSize}" />
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
      playZone:       data.playZone,
      fogDensity:     Number((document.getElementById('m-fog')   as HTMLInputElement).value),
      bgColor:        (document.getElementById('m-bg')     as HTMLInputElement).value,
      seed:           Number((document.getElementById('m-seed')  as HTMLInputElement).value),
      isActive:       (document.getElementById('m-active') as HTMLInputElement).checked,
      obstacleColors: colors,
    };

    try {
      if (map?.id) {
        await updateMap(map.id, payload);
      } else {
        await createMap(payload);
      }
      onSaved();
    } catch (e: any) {
      alert('저장 실패: ' + e.message);
    }
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/mapForm.ts
git commit -m "feat: add admin map form UI"
```

---

## Task 6: 어드민 main.ts에 맵 탭 추가

**Files:**
- Modify: `admin/src/main.ts`

- [ ] **Step 1: `admin/src/main.ts` 전체 교체**

현재 파일은 캐릭터만 처리한다. 맵 탭을 추가해 URL hash(`#maps` / `#characters`)로 전환한다.

```typescript
import { fetchCharacters, CharacterData } from './api';
import { renderList } from './characterList';
import { renderForm } from './characterForm';
import { fetchMaps, MapData } from './mapApi';
import { renderMapList } from './mapList';
import { renderMapForm } from './mapForm';

// ─── 탭 전환 ────────────────────────────────────────
const showTab = (tab: 'characters' | 'maps') => {
  const charSection = document.getElementById('characters-section')!;
  const mapSection  = document.getElementById('maps-section')!;
  const charTab     = document.getElementById('tab-characters')!;
  const mapTab      = document.getElementById('tab-maps')!;

  if (tab === 'characters') {
    charSection.style.display = '';
    mapSection.style.display  = 'none';
    charTab.classList.add('active');
    mapTab.classList.remove('active');
    loadCharacters();
  } else {
    charSection.style.display = 'none';
    mapSection.style.display  = '';
    charTab.classList.remove('active');
    mapTab.classList.add('active');
    loadMaps();
  }
};

// ─── 캐릭터 ────────────────────────────────────────
let characters: CharacterData[] = [];
let selectedCharId: string | null = null;

const loadCharacters = async () => {
  characters = await fetchCharacters();
  renderList(characters, selectedCharId, onSelectChar, onNewChar);
};

const onSelectChar = (char: CharacterData) => {
  selectedCharId = char._id ?? null;
  renderList(characters, selectedCharId, onSelectChar, onNewChar);
  renderForm(char, async () => { await loadCharacters(); });
};

const onNewChar = () => {
  selectedCharId = null;
  renderList(characters, selectedCharId, onSelectChar, onNewChar);
  renderForm(null, async () => { await loadCharacters(); });
};

// ─── 맵 ────────────────────────────────────────────
let maps: MapData[] = [];
let selectedMapId: number | null = null;

const loadMaps = async () => {
  maps = await fetchMaps();
  renderMapList(maps, selectedMapId, onSelectMap, onNewMap);
};

const onSelectMap = (map: MapData) => {
  selectedMapId = map.id ?? null;
  renderMapList(maps, selectedMapId, onSelectMap, onNewMap);
  renderMapForm(map, async () => { await loadMaps(); });
};

const onNewMap = () => {
  selectedMapId = null;
  renderMapList(maps, selectedMapId, onSelectMap, onNewMap);
  renderMapForm(null, async () => { await loadMaps(); });
};

// ─── 초기화 ─────────────────────────────────────────
document.getElementById('tab-characters')!.addEventListener('click', () => showTab('characters'));
document.getElementById('tab-maps')!.addEventListener('click',       () => showTab('maps'));

const hash = window.location.hash;
showTab(hash === '#maps' ? 'maps' : 'characters');
```

- [ ] **Step 2: `admin/index.html` 전체 교체**

기존 `admin/index.html` 을 아래로 교체한다. 핵심 변경:
- `<header>` 제목 변경
- 탭 버튼 추가
- 기존 캐릭터 영역을 `#characters-section` 으로 감쌈
- 맵 섹션(`#maps-section`)을 신규 추가; 폼 id는 `map-form-container` (캐릭터의 `form-container`와 충돌 방지)

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Game Admin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: monospace; background: #f5f5f5; height: 100vh; display: flex; flex-direction: column; }
    #app { display: flex; flex-direction: column; height: 100vh; }
    header { background: #333; color: #fff; padding: 12px 20px; font-size: 18px; display: flex; align-items: center; gap: 16px; }
    #tab-bar { display: flex; gap: 0; }
    .tab-btn { padding: 4px 18px; background: #555; border: none; color: #ccc; cursor: pointer; font-size: 13px; font-family: monospace; border-radius: 4px 4px 0 0; }
    .tab-btn.active { background: #f5f5f5; color: #333; }
    .layout { display: flex; flex: 1; overflow: hidden; }
    #list-panel { width: 280px; border-right: 1px solid #ddd; background: #fff; display: flex; flex-direction: column; }
    #form-panel { flex: 1; padding: 20px; overflow-y: auto; background: #fafafa; }
    .form-inner { display: flex; gap: 24px; }
    .preview-col { flex: 0 0 40%; min-height: 400px; position: sticky; top: 0; }
    .fields-col { flex: 1; overflow-y: auto; }
    .char-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #eee; cursor: pointer; }
    .char-item:hover { background: #f0f0f0; }
    .char-item.selected { background: #e8f4ff; border-left: 3px solid #4dabf7; }
    .char-item-name { font-size: 14px; }
    .char-item-actions button { background: none; border: none; cursor: pointer; font-size: 16px; padding: 2px 4px; }
    #add-btn, #map-add-btn { margin: 12px; padding: 10px; background: #4dabf7; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-family: monospace; }
    #add-btn:hover, #map-add-btn:hover { background: #339af0; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 13px; color: #555; margin-bottom: 6px; }
    .form-group input, .form-group select, .form-group textarea {
      width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px;
      font-size: 14px; font-family: monospace;
    }
    .form-group input[type="color"] { height: 40px; padding: 2px; cursor: pointer; }
    #preview-canvas { width: 100%; height: 100%; min-height: 400px; border-radius: 12px; border: 1px solid #ddd; background: #A2D2FF; display: block; }
    .form-actions { display: flex; gap: 8px; margin-top: 20px; }
    .form-actions button { flex: 1; padding: 10px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-family: monospace; }
    #save-btn { background: #51cf66; color: #fff; }
    #save-btn:hover { background: #40c057; }
    #cancel-btn { background: #dee2e6; color: #333; }
    #empty-state { padding: 20px; text-align: center; color: #aaa; font-size: 13px; }
    .color-row { display: flex; align-items: center; gap: 8px; }
    .color-row input[type="color"] { width: 50px; flex-shrink: 0; }
    .color-row input[type="text"] { flex: 1; }
  </style>
</head>
<body>
  <div id="app">
    <header>
      🌸 Game Admin
      <div id="tab-bar">
        <button id="tab-characters" class="tab-btn active">캐릭터</button>
        <button id="tab-maps" class="tab-btn">맵</button>
      </div>
    </header>

    <!-- 캐릭터 섹션 (기존 구조 유지) -->
    <div id="characters-section">
      <div class="layout">
        <div id="list-panel">
          <button id="add-btn">+ 새 캐릭터</button>
          <div id="character-list"></div>
        </div>
        <div id="form-panel">
          <div id="form-container">
            <p style="color:#aaa;padding:20px;">좌측에서 캐릭터를 선택하거나 새 캐릭터를 추가하세요.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 맵 섹션 (신규) — form id는 map-form-container (충돌 방지) -->
    <div id="maps-section" style="display:none;">
      <div class="layout">
        <div id="list-panel" style="width:280px;border-right:1px solid #ddd;background:#fff;display:flex;flex-direction:column;">
          <button id="map-add-btn">+ 새 맵</button>
          <div id="map-list"></div>
        </div>
        <div id="form-panel" style="flex:1;padding:20px;overflow-y:auto;background:#fafafa;">
          <div id="map-form-container">
            <p style="color:#aaa;padding:20px;">좌측에서 맵을 선택하거나 새 맵을 추가하세요.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 3: 어드민 빌드 확인**

```bash
cd admin && npm run build
```
Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add admin/src/main.ts admin/index.html
git commit -m "feat: add map management tab to admin site"
```

---

## Task 7: Socket.IO 룸 시스템 교체

**Files:**
- Modify: `server/src/index.ts`

현재 서버는 접속 즉시 `DEFAULT_ROOM`에 입장시킨다. 이를 `JOIN_MAP` 이벤트 수신 후 입장으로 변경한다.

- [ ] **Step 1: `server/src/index.ts` 의 `connection` 핸들러 수정**

`io.on('connection', ...)` 블록을 아래로 교체한다:

```typescript
io.on('connection', (socket: Socket) => {
  console.log(`플레이어 접속: ${socket.id}`);

  const auth = socket.handshake.auth as any;
  const playerName = String(auth?.playerName || '익명').slice(0, 12);

  // 플레이어 등록 (아직 맵 미할당)
  players[socket.id] = {
    id:          socket.id,
    name:        playerName,
    mapId:       null,            // JOIN_MAP 전까지 null
    position:    { x: 0, y: 1, z: 0 },
    quaternion:  { _x: 0, _y: 0, _z: 0, _w: 1 },
    bodyColor:   auth?.bodyColor   ?? '#FFB7B2',
    flowerColor: auth?.flowerColor ?? '#FFB7B2',
    visorColor:  auth?.visorColor  ?? '#333333',
    flowerType:  auth?.flowerType  ?? 'daisy',
    characterId: auth?.characterId ?? null,
    hp: 100,
  };

  // 로비에 있는 클라이언트들에게 맵별 접속자 수 전송
  broadcastMapPlayers();

  // ─── JOIN_MAP: 맵 선택 후 입장 ─────────────────────
  socket.on('JOIN_MAP', async (data: { mapId: number }) => {
    const mapId = String(data.mapId);

    // DB에서 맵 설정 조회
    const mapConfig = await MapModel.findById(data.mapId);
    if (!mapConfig) {
      socket.emit('MAP_ERROR', { message: 'Map not found' });
      return;
    }

    // 룸 입장
    socket.join(mapId);
    players[socket.id].mapId = mapId;

    // 1. MAP_CONFIG 먼저 전송
    socket.emit('MAP_CONFIG', mapConfig);

    // 2. 현재 맵의 플레이어 목록 전송
    const roomPlayers: Record<string, any> = {};
    for (const pid in players) {
      if (players[pid].mapId === mapId) {
        roomPlayers[pid] = players[pid];
      }
    }
    socket.emit('current_players', roomPlayers);

    // 3. 같은 맵 다른 플레이어들에게 신규 입장 알림
    socket.to(mapId).emit('player_joined', players[socket.id]);

    // 맵별 접속자 수 갱신 브로드캐스트
    broadcastMapPlayers();

    console.log(`플레이어 ${socket.id} → 맵 ${mapId} 입장`);
  });

  // ─── MOVE ───────────────────────────────────────────
  socket.on('MOVE', (data) => {
    const player = players[socket.id];
    if (!player || !player.mapId) return;
    player.position = data.position;
    if (data.quaternion) player.quaternion = data.quaternion;
    socket.to(player.mapId).emit('STATE_UPDATE', {
      id: socket.id,
      position:   data.position,
      quaternion: data.quaternion,
      upperYaw:   data.upperYaw,
      upperPitch: data.upperPitch,
    });
  });

  // ─── TAKE_DAMAGE ────────────────────────────────────
  socket.on('TAKE_DAMAGE', (data: { targetId: string, damage: number, shooterId: string, direction: {x:number,y:number,z:number} }) => {
    const target = players[data.targetId];
    if (!target || target.hp <= 0 || !target.mapId) return;
    target.hp -= data.damage;
    const mapId = target.mapId;
    if (target.hp <= 0) target.hp = 0;
    io.to(mapId).emit('PLAYER_DAMAGED', {
      targetId:  data.targetId,
      hp:        target.hp,
      shooterId: data.shooterId,
      direction: data.direction,
    });
  });

  // ─── SHOOT ──────────────────────────────────────────
  socket.on('SHOOT', (data: { origin: {x:number,y:number,z:number}; direction: {x:number,y:number,z:number} }) => {
    const mapId = players[socket.id]?.mapId;
    if (!mapId) return;
    socket.to(mapId).emit('SHOOT', { id: socket.id, origin: data.origin, direction: data.direction });
  });

  // ─── CHAT ───────────────────────────────────────────
  socket.on('CHAT_MESSAGE', (data: { text: string }) => {
    const mapId = players[socket.id]?.mapId;
    if (!mapId) return;
    socket.to(mapId).emit('CHAT_MESSAGE', {
      sender: players[socket.id]?.name || '익명',
      text:   data.text,
    });
  });

  // ─── DISCONNECT ─────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`플레이어 접속 해제: ${socket.id}`);
    const mapId = players[socket.id]?.mapId;
    delete players[socket.id];
    if (mapId) {
      io.to(mapId).emit('player_left', socket.id);
    }
    broadcastMapPlayers();
  });
});
```

- [ ] **Step 2: `broadcastMapPlayers` 헬퍼 함수 추가** (io.on 블록 위에 추가)

```typescript
/** 맵별 접속자 수를 전체 소켓에 broadcast */
const broadcastMapPlayers = () => {
  const counts: Record<string, number> = {};
  for (const pid in players) {
    const mapId = players[pid].mapId;
    if (mapId) {
      counts[mapId] = (counts[mapId] || 0) + 1;
    }
  }
  io.emit('MAP_PLAYERS', counts);
};
```

- [ ] **Step 3: 힐 인터벌에 맵 필터 추가**

기존 `setInterval` 블록의 내부 조건을 수정:

```typescript
// 기존: if (id1 === id2) continue;
// 변경: 동일 맵이 아니면 스킵
for (const id2 of playerIds) {
  if (id1 === id2) continue;
  const p2 = players[id2];
  if (!p2) continue;
  if (p1.mapId !== p2.mapId || !p1.mapId) continue;  // ← 추가
  // ... 거리 계산
}
```

- [ ] **Step 4: `MapModel` import 추가** (파일 상단)

```typescript
import * as MapModel from './models/Map.js';
```

- [ ] **Step 5: `DEFAULT_ROOM` 상수 삭제**

`DEFAULT_ROOM` 상수 및 `socket.join(DEFAULT_ROOM)` 호출은 더 이상 사용하지 않으므로 삭제한다.
(`TAKE_DAMAGE` 핸들러에서 `DEFAULT_ROOM` fallback도 제거되었으므로 컴파일 에러 없음)

- [ ] **Step 6: 빌드 확인**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add server/src/index.ts
git commit -m "feat: replace broadcast with map room system, add JOIN_MAP handler"
```

---

## Task 8: 클라이언트 MapConfig 타입 정의

**Files:**
- Create: `client/src/types/map.ts`

- [ ] **Step 1: `client/src/types/map.ts` 생성**

```typescript
export interface MapConfig {
  id: number;
  name: string;
  theme: string;
  floorSize: number;
  playZone: number;      // 장애물 배치 반경 (±playZone 유닛)
  obstacleCount: number;
  obstacleColors: string[];
  fogDensity: number;
  bgColor: string;
  seed: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/types/map.ts
git commit -m "feat: add MapConfig type"
```

---

## Task 9: world.ts 동적 맵 생성으로 리팩터

**Files:**
- Modify: `client/src/game/world.ts`

- [ ] **Step 1: `client/src/game/world.ts` 전체 교체**

```typescript
import * as THREE from 'three';
import { scene } from '../engine/scene';
import type { MapConfig } from '../types/map';

export const worldCollidables: THREE.Object3D[] = [];

export const initWorld = (config: MapConfig) => {
  // 이전 맵 오브젝트 초기화 (재로드 시 대비)
  worldCollidables.length = 0;

  const bgColor = new THREE.Color(config.bgColor);
  scene.background = bgColor;
  scene.fog = new THREE.FogExp2(bgColor.getHex(), config.fogDensity);

  // 조명
  const hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0xB9F3FC, 1.0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
  dirLight.position.set(50, 100, -50);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width  = 4096;
  dirLight.shadow.mapSize.height = 4096;
  dirLight.shadow.camera.near    = 1;
  dirLight.shadow.camera.far     = 400;
  dirLight.shadow.camera.left    = -100;
  dirLight.shadow.camera.right   = 100;
  dirLight.shadow.camera.top     = 100;
  dirLight.shadow.camera.bottom  = -100;
  dirLight.shadow.bias = -0.001;
  scene.add(dirLight);

  // 잔디 텍스처 (Canvas 절차적 생성)
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width  = 256;
  grassCanvas.height = 256;
  const ctx = grassCanvas.getContext('2d')!;
  ctx.fillStyle = '#5a9e3a';
  ctx.fillRect(0, 0, 256, 256);
  const rng = (seed: number) => {
    const x = Math.sin(seed) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 8000; i++) {
    const x = rng(i * 3.1) * 256;
    const y = rng(i * 7.4) * 256;
    const bright = rng(i * 2.2);
    ctx.fillStyle = `rgb(${Math.floor(60+bright*40)},${Math.floor(130+bright*60)},${Math.floor(30+bright*20)})`;
    ctx.fillRect(x, y, 2, rng(i * 5.7) * 4 + 1);
  }
  const grassTexture = new THREE.CanvasTexture(grassCanvas);
  grassTexture.wrapS = THREE.RepeatWrapping;
  grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(40, 40);

  // 바닥
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(config.floorSize, config.floorSize),
    new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 0.9, metalness: 0.0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  worldCollidables.push(floor);

  // 시드 기반 난수
  let seed = config.seed;
  const seededRandom = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  };

  // 장애물 생성
  const colors = config.obstacleColors.map(c => new THREE.Color(c).getHex());

  for (let i = 0; i < config.obstacleCount; i++) {
    const height = seededRandom() * 15 + 2;
    const width  = seededRandom() * 3 + 1;
    const depth  = seededRandom() * 3 + 1;
    const color  = colors[Math.floor(seededRandom() * colors.length)];

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.0 })
    );
    box.position.set(
      seededRandom() * config.playZone * 2 - config.playZone,
      height / 2,
      seededRandom() * config.playZone * 2 - config.playZone
    );
    box.castShadow    = true;
    box.receiveShadow = true;
    scene.add(box);
    worldCollidables.push(box);
  }
};
```

- [ ] **Step 2: 빌드 확인**

```bash
cd client && npx tsc --noEmit
```

Expected: `initWorld` 를 인자 없이 호출하는 `main.ts` 에서 타입 에러 발생 (정상, Task 12에서 수정)

- [ ] **Step 3: Commit**

```bash
git add client/src/game/world.ts
git commit -m "refactor: world.ts accepts MapConfig for dynamic map generation"
```

---

## Task 10: socket.ts에 맵 이벤트 추가

**Files:**
- Modify: `client/src/network/socket.ts`

- [ ] **Step 1: socket.ts 상단 import에 MapConfig 타입 추가**

```typescript
import type { MapConfig } from '../types/map';
```

- [ ] **Step 2: `JOIN_MAP` 전송 함수 추가** (파일 하단에 추가)

```typescript
export const joinMap = (mapId: number) => {
  socket.emit('JOIN_MAP', { mapId });
};
```

- [ ] **Step 3: `MAP_CONFIG` 수신 콜백 등록 함수 추가**

```typescript
export const onMapConfig = (callback: (config: MapConfig) => void) => {
  socket.on('MAP_CONFIG', callback);
};
```

- [ ] **Step 4: `MAP_PLAYERS` 수신 콜백 등록 함수 추가**

```typescript
export const onMapPlayers = (callback: (counts: Record<string, number>) => void) => {
  socket.on('MAP_PLAYERS', callback);
};
```

- [ ] **Step 5: 빌드 확인**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add client/src/network/socket.ts
git commit -m "feat: add joinMap, onMapConfig, onMapPlayers to socket"
```

---

## Task 11: 로비 오버레이 생성

**Files:**
- Create: `client/src/ui/lobby.ts`

- [ ] **Step 1: `client/src/ui/lobby.ts` 생성**

```typescript
import type { MapConfig } from '../types/map';

const API_URL = import.meta.env.VITE_SERVER_URL || 'http://220.85.41.214:3000';

interface MapInfo {
  id: number;
  name: string;
  bgColor: string;
}

export const showLobby = (): Promise<number> => {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = 'lobby-overlay';
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.85);
      display:flex; align-items:center; justify-content:center;
      z-index:9999; font-family:sans-serif; color:#eee;
    `;

    overlay.innerHTML = `
      <div style="background:#1a1a2e;border-radius:12px;padding:32px;min-width:320px;max-width:480px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
        <h2 style="text-align:center;margin:0 0 24px;font-size:20px;letter-spacing:2px;">🗺 맵 선택</h2>
        <div id="lobby-map-list" style="margin-bottom:24px;">
          <div style="text-align:center;color:#888;">맵 목록 불러오는 중...</div>
        </div>
        <button id="lobby-enter-btn" style="
          width:100%;padding:12px;background:#4caf50;border:none;border-radius:8px;
          color:#fff;font-size:16px;cursor:pointer;font-weight:bold;
        " disabled>입장하기</button>
      </div>
    `;

    document.body.appendChild(overlay);

    let selectedMapId: number | null = null;

    const renderMaps = (maps: MapInfo[], playerCounts: Record<string, number>) => {
      const listEl = document.getElementById('lobby-map-list')!;
      if (maps.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;color:#888;">등록된 맵이 없습니다.</div>';
        return;
      }
      listEl.innerHTML = '';
      maps.forEach((map) => {
        const item = document.createElement('div');
        const count = playerCounts[String(map.id)] || 0;
        const isSelected = map.id === selectedMapId;
        item.style.cssText = `
          display:flex;justify-content:space-between;align-items:center;
          padding:12px 16px;margin-bottom:8px;border-radius:8px;cursor:pointer;
          border:2px solid ${isSelected ? '#4caf50' : '#333'};
          background:${isSelected ? '#1e3a1e' : '#2a2a3e'};
          transition:border-color 0.2s;
        `;
        const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${map.bgColor};margin-right:8px;border:1px solid #555;"></span>`;
        item.innerHTML = `
          <span>${dot}${map.name}</span>
          <span style="color:#aaa;font-size:13px;">👥 ${count}명</span>
        `;
        item.addEventListener('click', () => {
          selectedMapId = map.id;
          renderMaps(maps, playerCounts);
          const enterBtn = document.getElementById('lobby-enter-btn') as HTMLButtonElement;
          enterBtn.disabled = false;
        });
        listEl.appendChild(item);
      });
    };

    // 맵 목록 불러오기
    let mapList: MapInfo[] = [];
    let currentCounts: Record<string, number> = {};

    fetch(`${API_URL}/api/maps`)
      .then(r => r.json())
      .then((maps: MapInfo[]) => {
        mapList = maps;
        renderMaps(mapList, currentCounts);
      })
      .catch(() => {
        document.getElementById('lobby-map-list')!.innerHTML =
          '<div style="text-align:center;color:#f44;">맵 목록을 불러오지 못했습니다.</div>';
      });

    // MAP_PLAYERS 이벤트로 실시간 갱신 (socket.ts 에서 등록)
    // main.ts에서 onMapPlayers를 연결함
    (window as any).__updateLobbyMapPlayers = (counts: Record<string, number>) => {
      currentCounts = counts;
      renderMaps(mapList, currentCounts);
    };

    document.getElementById('lobby-enter-btn')!.addEventListener('click', () => {
      if (selectedMapId === null) return;
      document.body.removeChild(overlay);
      delete (window as any).__updateLobbyMapPlayers;
      resolve(selectedMapId);
    });
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/ui/lobby.ts
git commit -m "feat: add lobby map selection overlay"
```

---

## Task 12: main.ts 시작 흐름 재구성

**Files:**
- Modify: `client/src/main.ts`

- [ ] **Step 1: `client/src/main.ts` 전체 교체**

```typescript
import './style.css';
import * as THREE from 'three';
import { renderer, mountRenderer } from './engine/renderer';
import { scene } from './engine/scene';
import { camera } from './engine/camera';
import { initWorld, worldCollidables } from './game/world';
import { initPlayer, updatePlayer, playerMesh, characterModel } from './game/player';
import {
  broadcastLocalPosition,
  sendChatMessage,
  sendShoot,
  connectWithCharacter,
  joinMap,
  onMapConfig,
  onMapPlayers,
} from './network/socket';
import { initHUD } from './ui/hud';
import { initChat } from './ui/chat';
import { showCharacterSelect } from './ui/characterSelect';
import { showLobby } from './ui/lobby';
import { createNameTag } from './game/nameTag';
import {
  initBulletInput,
  updateBullets,
  registerCollidables,
  setShootCallback,
} from './game/bullets';

// 화면에 렌더러 등록
mountRenderer('app');

// 플레이어 초기 세팅
initPlayer();

// HUD 초기화
initHUD();

// 채팅 초기화
initChat((msg: string) => { sendChatMessage(msg); });

// 탄환 발사 입력 초기화
initBulletInput();
setShootCallback((origin: THREE.Vector3, direction: THREE.Vector3) => {
  sendShoot(origin, direction);
});

const clock = new THREE.Clock();

const animate = () => {
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();
  updatePlayer(deltaTime);
  updateBullets(deltaTime);
  broadcastLocalPosition();
  renderer.render(scene, camera);
};

// ─── 시작 흐름 ────────────────────────────────────────
// 1. 캐릭터 선택
showCharacterSelect().then((selection) => {
  // 2. 소켓 연결 (캐릭터 auth 포함)
  const myTag = createNameTag(selection.playerName);
  myTag.name = 'nameTag';
  if ((characterModel as any).addNameTag) {
    (characterModel as any).addNameTag(myTag);
  } else {
    playerMesh.add(myTag);
  }
  connectWithCharacter(selection);

  // MAP_PLAYERS 수신 시 로비 UI 갱신
  onMapPlayers((counts) => {
    if ((window as any).__updateLobbyMapPlayers) {
      (window as any).__updateLobbyMapPlayers(counts);
    }
  });

  // 3. 로비 표시 (맵 선택)
  showLobby().then((selectedMapId) => {
    // 4. MAP_CONFIG 수신 대기 등록
    onMapConfig((config) => {
      // 5. 맵 초기화
      initWorld(config);

      // 탄환 충돌 대상 등록
      registerCollidables(worldCollidables);

      // 6. 게임 루프 시작
      animate();
    });

    // 7. JOIN_MAP 전송
    joinMap(selectedMapId);
  });
});
```

- [ ] **Step 2: 빌드 확인**

```bash
cd client && npx tsc --noEmit && npm run build
```
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add client/src/main.ts
git commit -m "refactor: restructure main.ts — character select → lobby → initWorld → game loop"
```

---

## Task 13: 기본 맵 데이터 DB 삽입

어드민 사이트에서 수동 입력하거나, 서버 시작 시 자동 시드 데이터를 삽입한다.
**어드민 사이트 UI 완성 후 직접 입력 권장.** 또는 아래 SQL을 실행한다.

- [ ] **Step 1: DB 서버에서 SQL 실행**

MySQL 접속: `mysql -h 220.85.41.214 -P 3306 -u twuser -p twdb`

```sql
INSERT INTO maps (name, theme, floor_size, play_zone, obstacle_count,
  obstacle_colors, fog_density, bg_color, seed, is_active)
VALUES
(
  'Pastel Garden', 'pastel', 400, 80, 80,
  '["#FFADAD","#FFD6A5","#FDFFB6","#CAFFBF","#9BF6FF","#A0C4FF","#BDB2FF","#FFC6FF"]',
  0.005, '#A2D2FF', 42, TRUE
),
(
  'Candy Land', 'candy', 400, 80, 80,
  '["#FF69B4","#FF1493","#FFB6C1","#FF6EB4","#FFC0CB","#FF85A1","#FF3399","#FFD700"]',
  0.003, '#FFB6C1', 1234, TRUE
);
```

- [ ] **Step 2: API로 확인**

```bash
curl http://220.85.41.214:3000/api/maps
# Expected: 두 맵이 반환됨
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: seed initial Pastel Garden and Candy Land map data" --allow-empty
```

---

## Task 14: 통합 테스트 및 최종 확인

- [ ] **Step 1: 서버 재시작 후 maps 테이블 자동 생성 확인**

```bash
cd server && npm run dev
# Expected 로그:
# ✅ MySQL 연결 성공
# ✅ characters 테이블 준비 완료
# ✅ maps 테이블 준비 완료
```

- [ ] **Step 2: 어드민 사이트 맵 탭 확인**

브라우저에서 `http://localhost:81/#maps` 접속
- 맵 목록 탭 표시 확인
- 새 맵 생성/수정/비활성화 동작 확인

- [ ] **Step 3: 게임 클라이언트 전체 플로우 확인**

브라우저에서 게임 접속:
1. 캐릭터 선택 화면 표시 → 선택
2. 로비 오버레이 표시 → 맵 목록 조회됨
3. 맵 선택 후 "입장하기" 클릭
4. 3D 맵 생성 및 게임 시작 확인

- [ ] **Step 4: 룸 격리 확인**

두 브라우저 탭 열기:
- 탭 A: Pastel Garden 선택
- 탭 B: Candy Land 선택
- 탭 A에서 이동/발사 → 탭 B에 전달되지 않음 확인

- [ ] **Step 5: 최종 Commit**

```bash
git add -A
git commit -m "feat: complete map system — lobby, room isolation, dynamic map generation"
```

---

## 참고: 핵심 파일 패턴 대조

| 역할 | 캐릭터 시스템 | 맵 시스템 |
|------|-------------|---------|
| DB 모델 | `server/src/models/Character.ts` | `server/src/models/Map.ts` |
| REST 라우트 | `server/src/routes/characters.ts` | `server/src/routes/maps.ts` |
| 어드민 API 클라이언트 | `admin/src/api.ts` | `admin/src/mapApi.ts` |
| 어드민 목록 UI | `admin/src/characterList.ts` | `admin/src/mapList.ts` |
| 어드민 폼 UI | `admin/src/characterForm.ts` | `admin/src/mapForm.ts` |
