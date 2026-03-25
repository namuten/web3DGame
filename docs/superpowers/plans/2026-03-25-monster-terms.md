# Monster Terms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 몬스터 몸 안에 표시되는 글자를 하드코딩에서 DB 기반 용어로 교체하고, 관리자 페이지에서 용어를 관리할 수 있도록 한다.

**Architecture:** 서버가 몬스터 스폰 시 MySQL에서 랜덤 용어를 조회해 `MONSTER_SPAWN` 소켓 이벤트에 포함시킨다. 클라이언트는 수신한 용어를 글자별로 분리해 동적 슬롯을 생성한다. 어드민 페이지는 기존 캐릭터/맵 탭 패턴과 동일하게 용어 탭을 추가한다.

**Tech Stack:** TypeScript, Express, Socket.io, MySQL2, Three.js, Vite

---

## File Map

| 상태 | 파일 | 역할 |
|------|------|------|
| Create | `server/src/models/MonsterTerm.ts` | DB 모델 (CRUD + findRandom) |
| Create | `server/src/routes/monsterTerms.ts` | REST API 라우터 |
| Modify | `server/src/index.ts` | 테이블 초기화, 라우터 등록, 스폰 로직 |
| Modify | `client/src/game/monster.ts` | MonsterData 인터페이스, 동적 슬롯 생성 |
| Create | `admin/src/termApi.ts` | 어드민 API 함수 |
| Create | `admin/src/termList.ts` | 어드민 목록 렌더링 |
| Create | `admin/src/termForm.ts` | 어드민 폼 렌더링 |
| Modify | `admin/src/main.ts` | 용어 탭 로직 추가 |
| Modify | `admin/index.html` | 용어 탭 HTML 추가 |

---

## Task 1: DB 모델 생성

**Files:**
- Create: `server/src/models/MonsterTerm.ts`

- [ ] **Step 1: `server/src/models/MonsterTerm.ts` 파일 생성**

```typescript
import { pool } from '../db.js';

export interface MonsterTerm {
  id: number;
  term: string;
  description: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const ensureTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS monster_terms (
      id          INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
      term        VARCHAR(20)   NOT NULL,
      description VARCHAR(200)  NOT NULL,
      createdAt   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updatedAt   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
};

const rowToTerm = (row: any): MonsterTerm => ({
  id:          row.id,
  term:        row.term,
  description: row.description,
  createdAt:   row.createdAt,
  updatedAt:   row.updatedAt,
});

export const findAll = async (): Promise<MonsterTerm[]> => {
  const [rows] = await pool.execute('SELECT * FROM monster_terms ORDER BY createdAt DESC');
  return (rows as any[]).map(rowToTerm);
};

export const findById = async (id: number): Promise<MonsterTerm | null> => {
  const [rows] = await pool.execute('SELECT * FROM monster_terms WHERE id = ?', [id]);
  const list = rows as any[];
  return list.length ? rowToTerm(list[0]!) : null;
};

export const findRandom = async (): Promise<MonsterTerm | null> => {
  const [rows] = await pool.execute('SELECT * FROM monster_terms ORDER BY RAND() LIMIT 1');
  const list = rows as any[];
  return list.length ? rowToTerm(list[0]!) : null;
};

export const create = async (data: Pick<MonsterTerm, 'term' | 'description'>): Promise<MonsterTerm> => {
  const [result] = await pool.execute(
    'INSERT INTO monster_terms (term, description) VALUES (?, ?)',
    [data.term, data.description]
  );
  const insertId = (result as any).insertId;
  return (await findById(insertId))!;
};

export const update = async (
  id: number,
  data: Partial<Pick<MonsterTerm, 'term' | 'description'>>
): Promise<MonsterTerm | null> => {
  const fields = Object.keys(data) as (keyof typeof data)[];
  if (!fields.length) return findById(id);
  const set = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (data as any)[f]);
  await pool.execute(`UPDATE monster_terms SET ${set} WHERE id = ?`, [...values, id]);
  return findById(id);
};

export const remove = async (id: number): Promise<boolean> => {
  const [result] = await pool.execute('DELETE FROM monster_terms WHERE id = ?', [id]);
  return (result as any).affectedRows > 0;
};
```

- [ ] **Step 2: 서버 빌드 확인**

```bash
cd /Users/nagee/git/web3DGame/server && npx tsc --noEmit
```
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add server/src/models/MonsterTerm.ts
git commit -m "feat: add MonsterTerm model with findRandom support"
```

---

## Task 2: REST API 라우터 생성

**Files:**
- Create: `server/src/routes/monsterTerms.ts`

- [ ] **Step 1: `server/src/routes/monsterTerms.ts` 파일 생성**

```typescript
import { Router } from 'express';
import type { Request, Response } from 'express';
import * as MonsterTerm from '../models/MonsterTerm.js';

const router = Router();

// 전체 목록
router.get('/', async (_req: Request, res: Response) => {
  try {
    const terms = await MonsterTerm.findAll();
    res.json(terms);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch terms', message: err.message });
  }
});

// 생성
router.post('/', async (req: Request, res: Response) => {
  try {
    const { term, description } = req.body;
    if (!term || typeof term !== 'string' || term.trim() === '') {
      return res.status(400).json({ error: 'term is required' });
    }
    if ([...term.trim()].length > 10) {
      return res.status(400).json({ error: 'term must be 10 characters or less' });
    }
    if (!description || typeof description !== 'string' || description.trim() === '') {
      return res.status(400).json({ error: 'description is required' });
    }
    if (description.trim().length > 200) {
      return res.status(400).json({ error: 'description must be 200 characters or less' });
    }
    const created = await MonsterTerm.create({ term: term.trim(), description: description.trim() });
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to create', message: err.message });
  }
});

// 수정
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { term, description } = req.body;
    const patch: Partial<Pick<any, 'term' | 'description'>> = {};
    if (term !== undefined) {
      if (typeof term !== 'string' || term.trim() === '') {
        return res.status(400).json({ error: 'term must be a non-empty string' });
      }
      if ([...term.trim()].length > 10) {
        return res.status(400).json({ error: 'term must be 10 characters or less' });
      }
      patch.term = term.trim();
    }
    if (description !== undefined) {
      if (typeof description !== 'string' || description.trim() === '') {
        return res.status(400).json({ error: 'description must be a non-empty string' });
      }
      if (description.trim().length > 200) {
        return res.status(400).json({ error: 'description must be 200 characters or less' });
      }
      patch.description = description.trim();
    }
    const updated = await MonsterTerm.update(id, patch);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to update', message: err.message });
  }
});

// 삭제
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const deleted = await MonsterTerm.remove(id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete', message: err.message });
  }
});

export default router;
```

- [ ] **Step 2: 빌드 확인**

```bash
cd /Users/nagee/git/web3DGame/server && npx tsc --noEmit
```
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/monsterTerms.ts
git commit -m "feat: add monster-terms REST API route with validation"
```

---

## Task 3: 서버 index.ts 수정 — 초기화 + 라우터 + 스폰 로직

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: import 추가**

`server/src/index.ts` 상단 import 블록에 추가:
```typescript
import { ensureTable as ensureMonsterTermTable } from './models/MonsterTerm.js';
import * as MonsterTermModel from './models/MonsterTerm.js';
import monsterTermRoutes from './routes/monsterTerms.js';
```

- [ ] **Step 2: 테이블 초기화 추가**

`ensureMapTable()` 호출 직후에 추가:
```typescript
await ensureMonsterTermTable();
console.log('✅ monster_terms 테이블 준비 완료');
```

- [ ] **Step 3: 라우터 등록**

`app.use('/api/maps', mapRoutes);` 바로 다음 줄에 추가:
```typescript
app.use('/api/monster-terms', monsterTermRoutes);
```

- [ ] **Step 4: 샘플 데이터 삽입 스크립트 작성**

`server/src/index.ts`와 별도로, 터미널에서 직접 MySQL에 접속해 샘플 데이터 삽입:

```sql
USE web3dgame;  -- 실제 DB명으로 변경

INSERT INTO monster_terms (term, description) VALUES
('퀀텀역학', '입자의 에너지를 다루는 물리학 분야'),
('블랙홀', '빛조차 탈출할 수 없는 강력한 중력장'),
('인공지능', '인간의 지능을 모방하는 컴퓨터 시스템'),
('딥러닝', '신경망을 이용한 기계학습 기법'),
('알고리즘', '문제를 해결하는 단계적 절차'),
('메타버스', '현실과 가상이 융합된 3D 공간'),
('블록체인', '분산형 디지털 장부 기술'),
('양자컴퓨터', '양자역학을 이용한 초고속 연산 장치'),
('나노기술', '나노미터 단위의 물질 제어 기술'),
('유전공학', 'DNA를 조작해 생물의 형질을 변형하는 기술');
```

DB 서버: `220.85.41.214` MySQL (프로젝트 메모리 참조)

- [ ] **Step 5: 스폰 로직 수정**

`server/src/index.ts`의 스폰 타이머 콜백 (setTimeout 내부)을 수정:

기존:
```typescript
spawnTimers[mapIdStr] = setTimeout(() => {
  const config = mapConfig;
  const limit = config.playZone || 80;
  const monster = {
    id: 'boss_slime',
    mapId: mapIdStr,
    position: { ... },
    targetId: null,
    speed: 0.45,
    alive: true,
    hp: 300,
    maxHp: 300,
    scale: 1.0
  };
  monsters[mapIdStr] = monster;
  io.to(mapIdStr).emit('MONSTER_SPAWN', monster);
  ...
  delete spawnTimers[mapIdStr];
}, 5000);
```

변경 후 (async 콜백으로 교체):
```typescript
spawnTimers[mapIdStr] = setTimeout(async () => {
  const config = mapConfig;
  const limit = config.playZone || 80;
  const termRecord = await MonsterTermModel.findRandom();
  const monster = {
    id: 'boss_slime',
    mapId: mapIdStr,
    position: {
      x: (Math.random() - 0.5) * limit * 0.8,
      y: 5,
      z: (Math.random() - 0.5) * limit * 0.8
    },
    targetId: null,
    speed: 0.45,
    alive: true,
    hp: 300,
    maxHp: 300,
    scale: 1.0,
    term: termRecord?.term ?? undefined,
    termDesc: termRecord?.description ?? undefined,
  };
  monsters[mapIdStr] = monster;
  io.to(mapIdStr).emit('MONSTER_SPAWN', monster);
  io.to(mapIdStr).emit('CHAT_MESSAGE', { sender: 'SYSTEM_DEBUG', text: `[DEBUG] Slime Spawned at X:${monster.position.x.toFixed(1)}, Z:${monster.position.z.toFixed(1)}` });
  delete spawnTimers[mapIdStr];
}, 5000);
```

- [ ] **Step 6: 빌드 확인**

```bash
cd /Users/nagee/git/web3DGame/server && npx tsc --noEmit
```
Expected: 에러 없음

- [ ] **Step 7: Commit**

```bash
git add server/src/index.ts
git commit -m "feat: integrate monster-terms into spawn logic and register route"
```

---

## Task 4: 클라이언트 monster.ts 수정

**Files:**
- Modify: `client/src/game/monster.ts`

- [ ] **Step 1: MonsterData 인터페이스 교체**

파일 상단 기존 인터페이스:
```typescript
export interface MonsterData {
    id: string;
    position: { x: number; y: number; z: number };
}
```

교체:
```typescript
export interface MonsterData {
    id: string;
    mapId?: string;
    position: { x: number; y: number; z: number };
    targetId?: string | null;
    speed?: number;
    alive?: boolean;
    hp?: number;
    maxHp?: number;
    scale?: number;
    term?: string;
    termDesc?: string;
}
```

- [ ] **Step 2: createKoreanLetterMesh 함수 시그니처 변경**

기존:
```typescript
function createKoreanLetterMesh() {
    const chars = [
        "가","나","다","라","마","바","사","아","자","차","카","타","파","하",
        "거","너","더","러","머","버","서","어","저","처","커","터","퍼","허",
        "왕","슬","라","임","똥","별","달","돈","힘","꿈","빛","콩","팡","쾅",
        "퓩","뽕","쓩","앗","잉","헉","얍","읏","멍","냥","꿀","빔","빵","뿅"
    ];
    const text = chars[Math.floor(Math.random() * chars.length)];
```

교체 (함수 선언부 첫 3줄만):
```typescript
function createKoreanLetterMesh(char: string) {
    const text = char;
```

나머지 함수 본문(canvas 렌더링, material, geometry, layers)은 그대로 유지.

- [ ] **Step 3: spawn 메서드의 글자 슬롯 생성 부분 수정**

기존 (line ~123):
```typescript
        // 3. 내부 글자 메쉬 4개 추가
        this.innerChars = [];
        for (let i = 0; i < 4; i++) {
            const mesh = createKoreanLetterMesh();
            // 약간 작게 조절 (4개가 들어가므로 더 작게)
            mesh.scale.set(0.65, 0.65, 0.65);
            group.add(mesh);
            this.innerChars.push({
                mesh,
                pos: new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6),
                vel: new THREE.Vector3(),
                rot: new THREE.Euler(),
                rotVel: new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10
                )
            });
        }
```

교체:
```typescript
        // 3. 내부 글자 메쉬 - DB 용어 글자 수에 맞게 동적 생성
        const FALLBACK_CHARS = [
            "가","나","다","라","마","바","사","아","자","차","카","타","파","하",
            "거","너","더","러","머","버","서","어","저","처","커","터","퍼","허",
            "왕","슬","라","임","똥","별","달","돈","힘","꿈","빛","콩","팡","쾅"
        ];
        let termChars: string[];
        if (data.term && data.term.length > 0) {
            const spread = [...data.term].slice(0, 10);
            termChars = spread;
        } else {
            termChars = Array.from({ length: 4 }, () =>
                FALLBACK_CHARS[Math.floor(Math.random() * FALLBACK_CHARS.length)]
            );
        }
        this.innerChars = [];
        for (const char of termChars) {
            const mesh = createKoreanLetterMesh(char);
            mesh.scale.set(0.65, 0.65, 0.65);
            group.add(mesh);
            this.innerChars.push({
                mesh,
                pos: new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6),
                vel: new THREE.Vector3(),
                rot: new THREE.Euler(),
                rotVel: new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10
                )
            });
        }
```

- [ ] **Step 4: 클라이언트 빌드 확인**

```bash
cd /Users/nagee/git/web3DGame/client && npx tsc --noEmit
```
Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
git add client/src/game/monster.ts
git commit -m "feat: dynamic monster letter slots from DB term"
```

---

## Task 5: 어드민 — termApi.ts 생성

**Files:**
- Create: `admin/src/termApi.ts`

- [ ] **Step 1: `admin/src/termApi.ts` 파일 생성**

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://220.85.41.214:3000';
const BASE = `${API_URL}/api/monster-terms`;

export interface TermData {
  id?: number;
  term: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

export const fetchTerms = async (): Promise<TermData[]> => {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error('Failed to fetch terms');
  return res.json();
};

export const createTerm = async (data: Pick<TermData, 'term' | 'description'>): Promise<TermData> => {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const updateTerm = async (id: number, data: Partial<Pick<TermData, 'term' | 'description'>>): Promise<TermData> => {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const deleteTerm = async (id: number): Promise<void> => {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
};
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/termApi.ts
git commit -m "feat: add termApi for admin monster-terms management"
```

---

## Task 6: 어드민 — termList.ts 생성

**Files:**
- Create: `admin/src/termList.ts`

- [ ] **Step 1: `admin/src/termList.ts` 파일 생성**

```typescript
import { TermData, deleteTerm } from './termApi';

type OnSelect = (term: TermData) => void;
type OnNew = () => void;

export const renderTermList = (
  terms: TermData[],
  selectedId: number | null,
  onSelect: OnSelect,
  onNew: OnNew
) => {
  const listEl = document.getElementById('term-list')!;
  const addBtn = document.getElementById('term-add-btn')!;

  listEl.innerHTML = '';

  if (terms.length === 0) {
    listEl.innerHTML = '<div id="empty-state">용어가 없습니다</div>';
  }

  terms.forEach((term) => {
    const item = document.createElement('div');
    item.className = 'char-item' + (term.id === selectedId ? ' selected' : '');

    const name = document.createElement('span');
    name.className = 'char-item-name';
    name.textContent = term.term;

    const actions = document.createElement('div');
    actions.className = 'char-item-actions';

    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️';
    editBtn.title = '편집';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect(term);
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑';
    delBtn.title = '삭제';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`"${term.term}"을 삭제할까요?`)) return;
      await deleteTerm(term.id!);
      window.location.reload();
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    item.appendChild(name);
    item.appendChild(actions);
    item.addEventListener('click', () => onSelect(term));
    listEl.appendChild(item);
  });

  addBtn.onclick = onNew;
};
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/termList.ts
git commit -m "feat: add termList component for admin"
```

---

## Task 7: 어드민 — termForm.ts 생성

**Files:**
- Create: `admin/src/termForm.ts`

- [ ] **Step 1: `admin/src/termForm.ts` 파일 생성**

```typescript
import { TermData, createTerm, updateTerm } from './termApi';

export const renderTermForm = (term: TermData | null, onSaved: () => void) => {
  const container = document.getElementById('term-form-container')!;

  container.innerHTML = `
    <h2 style="margin-bottom:20px;font-size:16px;">${term ? '용어 편집' : '새 용어'}</h2>
    <div class="fields-col" style="max-width:480px;">
      <div class="form-group">
        <label>용어 * (최대 10자)</label>
        <input id="t-term" type="text" maxlength="10" value="${term?.term ?? ''}" placeholder="예: 퀀텀역학" />
      </div>
      <div class="form-group">
        <label>설명 * (최대 200자)</label>
        <textarea id="t-desc" maxlength="200" rows="4" placeholder="용어에 대한 설명을 입력하세요">${term?.description ?? ''}</textarea>
      </div>
      <div class="form-actions">
        <button id="t-save-btn" style="background:#51cf66;color:#fff;">저장</button>
        <button id="t-cancel-btn" style="background:#dee2e6;color:#333;">취소</button>
      </div>
    </div>
  `;

  document.getElementById('t-cancel-btn')!.addEventListener('click', () => {
    container.innerHTML = '<p style="color:#aaa;padding:20px;">좌측에서 용어를 선택하거나 새 용어를 추가하세요.</p>';
  });

  document.getElementById('t-save-btn')!.addEventListener('click', async () => {
    const termVal = (document.getElementById('t-term') as HTMLInputElement).value.trim();
    const descVal = (document.getElementById('t-desc') as HTMLTextAreaElement).value.trim();

    if (!termVal) { alert('용어를 입력하세요.'); return; }
    if (!descVal) { alert('설명을 입력하세요.'); return; }

    try {
      if (term?.id) {
        await updateTerm(term.id, { term: termVal, description: descVal });
      } else {
        await createTerm({ term: termVal, description: descVal });
      }
      alert('저장되었습니다.');
      onSaved();
    } catch (e: any) {
      alert('저장 실패: ' + e.message);
    }
  });
};
```

- [ ] **Step 2: 어드민 빌드 확인**

```bash
cd /Users/nagee/git/web3DGame/admin && npx tsc --noEmit
```
Expected: 에러 없음 (아직 main.ts/index.html 미연결이라 import 오류 없어야 함)

- [ ] **Step 3: Commit**

```bash
git add admin/src/termForm.ts
git commit -m "feat: add termForm component for admin"
```

---

## Task 8: 어드민 — index.html 및 main.ts 수정

**Files:**
- Modify: `admin/index.html`
- Modify: `admin/src/main.ts`

- [ ] **Step 1: `admin/index.html` — 탭 버튼 추가**

기존:
```html
        <button id="tab-characters" class="tab-btn active">캐릭터</button>
        <button id="tab-maps" class="tab-btn">맵</button>
```

교체:
```html
        <button id="tab-characters" class="tab-btn active">캐릭터</button>
        <button id="tab-maps" class="tab-btn">맵</button>
        <button id="tab-terms" class="tab-btn">용어</button>
```

- [ ] **Step 2: `admin/index.html` — 용어 섹션 HTML 추가**

`</div>` (maps-section 닫는 태그) 바로 다음에 추가:
```html
    <div id="terms-section" style="display:none;">
      <div class="layout">
        <div id="term-list-panel" style="width:280px;border-right:1px solid #ddd;background:#fff;display:flex;flex-direction:column;">
          <button id="term-add-btn" style="margin:12px;padding:10px;background:#4dabf7;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-family:monospace;">+ 새 용어</button>
          <div id="term-list"></div>
        </div>
        <div id="term-form-panel" style="flex:1;padding:20px;overflow-y:auto;background:#fafafa;">
          <div id="term-form-container">
            <p style="color:#aaa;padding:20px;">좌측에서 용어를 선택하거나 새 용어를 추가하세요.</p>
          </div>
        </div>
      </div>
    </div>
```

- [ ] **Step 3: `admin/src/main.ts` — import 추가**

파일 상단 import 블록에 추가:
```typescript
import { fetchTerms, TermData } from './termApi';
import { renderTermList } from './termList';
import { renderTermForm } from './termForm';
```

- [ ] **Step 4: `admin/src/main.ts` — showTab 함수 수정**

기존 `showTab` 함수 시그니처와 내부:
```typescript
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
```

교체:
```typescript
const showTab = (tab: 'characters' | 'maps' | 'terms') => {
  const charSection  = document.getElementById('characters-section')!;
  const mapSection   = document.getElementById('maps-section')!;
  const termsSection = document.getElementById('terms-section')!;
  const charTab      = document.getElementById('tab-characters')!;
  const mapTab       = document.getElementById('tab-maps')!;
  const termsTab     = document.getElementById('tab-terms')!;

  charSection.style.display  = tab === 'characters' ? '' : 'none';
  mapSection.style.display   = tab === 'maps'       ? '' : 'none';
  termsSection.style.display = tab === 'terms'      ? '' : 'none';
  charTab.classList.toggle('active',  tab === 'characters');
  mapTab.classList.toggle('active',   tab === 'maps');
  termsTab.classList.toggle('active', tab === 'terms');

  if (tab === 'characters') loadCharacters();
  else if (tab === 'maps')  loadMaps();
  else                      loadTerms();
};
```

- [ ] **Step 5: `admin/src/main.ts` — 용어 관련 로직 추가**

파일 내 맵 관련 로직 블록 (`// ─── 맵 ───`) 다음에 추가:
```typescript
// ─── 용어 ────────────────────────────────────────────
let terms: TermData[] = [];
let selectedTermId: number | null = null;

const loadTerms = async () => {
  terms = await fetchTerms();
  renderTermList(terms, selectedTermId, onSelectTerm, onNewTerm);
};

const onSelectTerm = (term: TermData) => {
  selectedTermId = term.id ?? null;
  renderTermList(terms, selectedTermId, onSelectTerm, onNewTerm);
  renderTermForm(term, async () => { await loadTerms(); });
};

const onNewTerm = () => {
  selectedTermId = null;
  renderTermList(terms, selectedTermId, onSelectTerm, onNewTerm);
  renderTermForm(null, async () => { await loadTerms(); });
};
```

- [ ] **Step 6: `admin/src/main.ts` — 탭 이벤트 리스너 추가**

기존 이벤트 리스너 블록에 추가:
```typescript
document.getElementById('tab-terms')!.addEventListener('click', () => showTab('terms'));
```

- [ ] **Step 7: `admin/src/main.ts` — 초기 탭 hash 처리 수정**

기존:
```typescript
const hash = window.location.hash;
showTab(hash === '#maps' ? 'maps' : 'characters');
```

교체:
```typescript
const hash = window.location.hash;
showTab(hash === '#maps' ? 'maps' : hash === '#terms' ? 'terms' : 'characters');
```

- [ ] **Step 8: 어드민 빌드 확인**

```bash
cd /Users/nagee/git/web3DGame/admin && npx tsc --noEmit
```
Expected: 에러 없음

- [ ] **Step 9: Commit**

```bash
git add admin/index.html admin/src/main.ts
git commit -m "feat: add monster-terms tab to admin page"
```

---

## Task 9: 수동 검증

- [ ] **Step 1: 서버 재시작 및 테이블 생성 확인**

```bash
cd /Users/nagee/git/web3DGame/server && npm run dev
```
Expected 로그:
```
✅ MySQL 연결 성공
✅ characters 테이블 준비 완료
✅ maps 테이블 준비 완료
✅ monster_terms 테이블 준비 완료
```

- [ ] **Step 2: 샘플 데이터 삽입 확인**

MySQL DB 서버(`220.85.41.214`)에 접속하여 샘플 데이터 10건 삽입 (Task 3 Step 4 SQL 사용).

- [ ] **Step 3: REST API 동작 확인**

```bash
curl http://220.85.41.214:3000/api/monster-terms
```
Expected: 샘플 데이터 JSON 배열 반환

- [ ] **Step 4: 어드민 페이지 확인**

어드민 페이지에서 "용어" 탭 클릭 → 목록 표시 → 새 용어 추가/편집/삭제 동작 확인

- [ ] **Step 5: 게임 클라이언트 확인**

게임 접속 후 맵 입장 → 5초 후 몬스터 스폰 → 몬스터 몸 안에 DB에서 가져온 용어 글자가 표시되는지 확인 (예: "퀀텀역학"이면 글자 4개 슬롯)

- [ ] **Step 6: 최종 Commit**

```bash
git add -A
git commit -m "feat: monster terms DB integration complete"
```
