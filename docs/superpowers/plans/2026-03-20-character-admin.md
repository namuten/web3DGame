# Character Admin System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 캐릭터 프리셋을 생성/관리하는 Admin 앱을 만들고, MongoDB에 저장한 캐릭터를 게임 시작 시 플레이어가 선택할 수 있게 한다.

**Architecture:** 기존 server에 Mongoose + REST API를 추가하고, 별도 Vite Admin 앱을 신규 생성한다. 게임 클라이언트의 이름 입력 화면을 캐릭터 선택 화면으로 교체한다.

**Tech Stack:** Node.js/Express, Mongoose/MongoDB, Vite + TypeScript, Three.js, Socket.IO

**Spec:** `docs/superpowers/specs/2026-03-20-character-admin-design.md`

---

## File Map

### 신규 생성
| 파일 | 역할 |
|---|---|
| `server/src/models/Character.ts` | Mongoose 스키마 + 유효성 검사 |
| `server/src/routes/characters.ts` | REST CRUD 라우터 |
| `admin/index.html` | Admin 앱 진입점 |
| `admin/package.json` | Admin 앱 의존성 |
| `admin/tsconfig.json` | TypeScript 설정 |
| `admin/vite.config.ts` | Vite 설정 |
| `admin/src/main.ts` | Admin 앱 초기화 |
| `admin/src/api.ts` | REST API 호출 함수 |
| `admin/src/utils.ts` | toThreeColor 등 유틸 |
| `admin/src/characterList.ts` | 좌측 목록 UI |
| `admin/src/characterForm.ts` | 우측 폼 UI |
| `admin/src/preview3d.ts` | Three.js 3D 미리보기 |
| `client/src/ui/characterSelect.ts` | 캐릭터 선택 화면 |
| `client/src/utils.ts` | toThreeColor 유틸 |

### 수정
| 파일 | 변경 내용 |
|---|---|
| `server/src/index.ts` | MongoDB 연결, 라우터 등록, handshake 처리 변경 |
| `server/package.json` | mongoose 의존성 추가 |
| `client/src/game/characterModel.ts` | `setVisorColor()` 메서드 추가 |
| `client/src/game/player.ts` | `setPlayerColor()` visorColor 인자 추가 |
| `client/src/network/socket.ts` | `connectWithCharacter()` 추가, `connectWithName` 제거, `PLAYER_NAME` 리스너 제거, 색상 hex 변환 적용 |
| `client/src/main.ts` | `showNameInput`/`connectWithName` → `showCharacterSelect`/`connectWithCharacter` 교체 |

---

## Task 1: characterModel에 setVisorColor() 추가

**Files:**
- Modify: `client/src/game/characterModel.ts`

- [ ] **Step 1: `setVisorColor` 메서드 추가**

`client/src/game/characterModel.ts`의 `setBodyColor` 헬퍼 바로 아래에 추가:

```typescript
// 바이저 색상 변경
(root as any).setVisorColor = (newColor: number) => {
  visor.material = new THREE.MeshStandardMaterial({
    color: newColor,
    roughness: 0.2,
    metalness: 0.1,
  });
};
```

- [ ] **Step 2: 브라우저에서 수동 확인**

```bash
cd client && npm run dev
```
브라우저 콘솔에서 확인:
```javascript
// 개발자 도구 콘솔에서 실행 가능 여부 확인 (에러 없으면 OK)
```
빌드 에러 없으면 통과.

- [ ] **Step 3: 커밋**

```bash
git add client/src/game/characterModel.ts
git commit -m "feat: add setVisorColor() to characterModel"
```

---

## Task 2: server에 mongoose 설치 및 Character 모델 생성

**Files:**
- Modify: `server/package.json`
- Create: `server/src/models/Character.ts`

- [ ] **Step 1: mongoose 설치**

```bash
cd server && npm install mongoose
```

Expected: `package.json`에 `"mongoose"` 추가됨. (Mongoose v6+는 자체 TypeScript 타입 내장, `@types/mongoose` 불필요)

- [ ] **Step 2: Character 모델 생성**

`server/src/models/Character.ts` 생성:

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface ICharacter extends Document {
  name: string;
  description?: string;
  bodyColor: string;
  flowerColor: string;
  visorColor: string;
  flowerType: string;
  createdAt: Date;
}

const hexColorValidator = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);

const CharacterSchema = new Schema<ICharacter>({
  name: {
    type: String,
    required: true,
    minlength: 1,
    maxlength: 20,
    trim: true,
  },
  description: {
    type: String,
    maxlength: 100,
    default: '',
  },
  bodyColor: {
    type: String,
    required: true,
    validate: { validator: hexColorValidator, message: 'Invalid hex color' },
  },
  flowerColor: {
    type: String,
    required: true,
    validate: { validator: hexColorValidator, message: 'Invalid hex color' },
  },
  visorColor: {
    type: String,
    required: true,
    validate: { validator: hexColorValidator, message: 'Invalid hex color' },
  },
  flowerType: {
    type: String,
    required: true,
    enum: ['daisy'],
    default: 'daisy',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Character = mongoose.model<ICharacter>('Character', CharacterSchema);
```

- [ ] **Step 3: TypeScript 빌드 확인**

```bash
cd server && npm run build
```
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add server/package.json server/package-lock.json server/src/models/Character.ts
git commit -m "feat: add Character mongoose model"
```

---

## Task 3: 캐릭터 REST API 라우터 구현

**Files:**
- Create: `server/src/routes/characters.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: 라우터 파일 생성**

`server/src/routes/characters.ts` 생성:

```typescript
import { Router, Request, Response } from 'express';
import { Character } from '../models/Character';

const router = Router();

// 전체 목록
router.get('/', async (_req: Request, res: Response) => {
  try {
    const characters = await Character.find().sort({ createdAt: 1 });
    res.json(characters);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch characters' });
  }
});

// 단일 조회
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const character = await Character.findById(req.params.id);
    if (!character) return res.status(404).json({ error: 'Not found' });
    res.json(character);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch character' });
  }
});

// 생성
router.post('/', async (req: Request, res: Response) => {
  try {
    const character = new Character(req.body);
    await character.save();
    res.status(201).json(character);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 수정
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const character = await Character.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!character) return res.status(404).json({ error: 'Not found' });
    res.json(character);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 삭제
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const character = await Character.findByIdAndDelete(req.params.id);
    if (!character) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

export default router;
```

- [ ] **Step 2: index.ts에 MongoDB 연결 및 라우터 등록**

`server/src/index.ts` 상단 import 블록에 추가:
```typescript
import mongoose from 'mongoose';
import characterRoutes from './routes/characters';
```

`const app = express();` 바로 아래에 추가:
```typescript
app.use(express.json());

// MongoDB 연결
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/web3dgame';
mongoose.connect(MONGO_URL)
  .then(() => console.log('✅ MongoDB 연결 성공'))
  .catch((err) => console.error('❌ MongoDB 연결 실패:', err));

// 캐릭터 API 라우터
app.use('/api/characters', characterRoutes);
```

- [ ] **Step 3: MongoDB 로컬 실행 확인**

```bash
# MongoDB가 설치되어 있어야 함
mongod --version
# 없으면: brew install mongodb-community
```

- [ ] **Step 4: 서버 실행 후 API 테스트**

터미널 1:
```bash
cd server && npm run dev
```

터미널 2 (API 테스트):
```bash
# 캐릭터 생성
curl -X POST http://localhost:3000/api/characters \
  -H "Content-Type: application/json" \
  -d '{"name":"Daisy Pink","description":"핑크 데이지","bodyColor":"#FFB7B2","flowerColor":"#FFB7B2","visorColor":"#333333","flowerType":"daisy"}'

# 목록 조회
curl http://localhost:3000/api/characters
```

Expected: 201 응답에 `_id` 포함된 JSON, 목록 조회에 1개 항목.

- [ ] **Step 5: 커밋**

```bash
git add server/src/routes/characters.ts server/src/index.ts
git commit -m "feat: add character CRUD REST API with MongoDB"
```

---

## Task 4: server handshake 처리 변경

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: players 초기화 블록 변경**

`server/src/index.ts`에서 아래 기존 코드를 찾아서:

```typescript
const bodyColors = [0xff6b6b, 0xff9f43, 0xffd32a, 0x6bcb77, 0x4dabf7, 0xcc5de8, 0xff6eb4, 0x38d9a9];

const playerName = String((socket.handshake.auth as any)?.playerName || '익명').slice(0, 12);

players[socket.id] = {
  id: socket.id,
  name: playerName,
  room: DEFAULT_ROOM,
  position: { x: 0, y: 1, z: 0 },
  quaternion: { _x: 0, _y: 0, _z: 0, _w: 1 },
  bodyColor: bodyColors[Math.floor(Math.random() * bodyColors.length)],
  flowerColor: 0xffffff,
  hp: 100,
};
```

아래로 교체:

```typescript
const auth = socket.handshake.auth as any;
const playerName = String(auth?.playerName || '익명').slice(0, 12);

players[socket.id] = {
  id: socket.id,
  name: playerName,
  room: DEFAULT_ROOM,
  position: { x: 0, y: 1, z: 0 },
  quaternion: { _x: 0, _y: 0, _z: 0, _w: 1 },
  bodyColor:   auth?.bodyColor   ?? '#FFB7B2',
  flowerColor: auth?.flowerColor ?? '#FFB7B2',
  visorColor:  auth?.visorColor  ?? '#333333',
  flowerType:  auth?.flowerType  ?? 'daisy',
  characterId: auth?.characterId ?? null,
  hp: 100,
};
```

- [ ] **Step 2: SET_NAME 이벤트 제거**

`server/src/index.ts`에서 아래 블록 전체 삭제:

```typescript
// 이름 설정 이벤트
socket.on('SET_NAME', (name: string) => {
  if (players[socket.id]) {
    players[socket.id].name = String(name).slice(0, 12) || '익명';
    socket.to(players[socket.id].room).emit('PLAYER_NAME', {
      id: socket.id,
      name: players[socket.id].name,
    });
  }
});
```

- [ ] **Step 3: 서버 재시작 후 확인**

```bash
cd server && npm run dev
```
에러 없이 구동되면 통과.

- [ ] **Step 4: 커밋**

```bash
git add server/src/index.ts
git commit -m "feat: replace random color with client handshake character data"
```

---

## Task 5: Admin 앱 프로젝트 초기화

**Files:**
- Create: `admin/index.html`, `admin/package.json`, `admin/tsconfig.json`, `admin/vite.config.ts`

- [ ] **Step 1: admin 폴더 초기화**

```bash
mkdir -p admin/src
cd admin
npm init -y
npm install vite typescript three @types/three --save-dev
```

- [ ] **Step 2: `admin/tsconfig.json` 생성**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: `admin/vite.config.ts` 생성**

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5174 },
});
```

- [ ] **Step 4: `admin/package.json` scripts 수정**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}
```

- [ ] **Step 5: `admin/index.html` 생성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Character Admin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: monospace; background: #f5f5f5; height: 100vh; display: flex; flex-direction: column; }
    #app { display: flex; flex-direction: column; height: 100vh; }
    header { background: #333; color: #fff; padding: 12px 20px; font-size: 18px; }
    .layout { display: flex; flex: 1; overflow: hidden; }
    #list-panel { width: 280px; border-right: 1px solid #ddd; background: #fff; display: flex; flex-direction: column; }
    #form-panel { flex: 1; padding: 20px; overflow-y: auto; background: #fafafa; }
    .char-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #eee; cursor: pointer; }
    .char-item:hover { background: #f0f0f0; }
    .char-item.selected { background: #e8f4ff; border-left: 3px solid #4dabf7; }
    .char-item-name { font-size: 14px; }
    .char-item-actions button { background: none; border: none; cursor: pointer; font-size: 16px; padding: 2px 4px; }
    #add-btn { margin: 12px; padding: 10px; background: #4dabf7; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-family: monospace; }
    #add-btn:hover { background: #339af0; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 13px; color: #555; margin-bottom: 6px; }
    .form-group input, .form-group select, .form-group textarea {
      width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px;
      font-size: 14px; font-family: monospace;
    }
    .form-group input[type="color"] { height: 40px; padding: 2px; cursor: pointer; }
    #preview-canvas { width: 100%; height: 220px; border-radius: 8px; border: 1px solid #ddd; background: #A2D2FF; display: block; }
    .form-actions { display: flex; gap: 8px; margin-top: 20px; }
    .form-actions button { flex: 1; padding: 10px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-family: monospace; }
    #save-btn { background: #51cf66; color: #fff; }
    #save-btn:hover { background: #40c057; }
    #cancel-btn { background: #dee2e6; color: #333; }
    #empty-state { padding: 20px; text-align: center; color: #aaa; font-size: 13px; }
  </style>
</head>
<body>
  <div id="app">
    <header>🌸 Character Admin</header>
    <div class="layout">
      <div id="list-panel">
        <button id="add-btn">+ 새 캐릭터</button>
        <div id="character-list"></div>
      </div>
      <div id="form-panel">
        <div id="form-container"></div>
      </div>
    </div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 6: 빈 main.ts로 개발 서버 확인**

`admin/src/main.ts` 생성:
```typescript
console.log('Admin app loaded');
```

```bash
cd admin && npm run dev
```
Expected: http://localhost:5174 에서 "🌸 Character Admin" 헤더 표시.

- [ ] **Step 7: 커밋**

```bash
cd ..
git add admin/
git commit -m "feat: scaffold admin app (Vite + TypeScript)"
```

---

## Task 6: Admin 앱 — API 클라이언트 및 유틸

**Files:**
- Create: `admin/src/api.ts`, `admin/src/utils.ts`

- [ ] **Step 1: `admin/src/utils.ts` 생성**

```typescript
export const toThreeColor = (hex: string): number =>
  parseInt(hex.replace('#', ''), 16);

export const toHexString = (color: number): string =>
  '#' + color.toString(16).padStart(6, '0').toUpperCase();
```

- [ ] **Step 2: `admin/src/api.ts` 생성**

```typescript
const BASE = 'http://localhost:3000/api/characters';

export interface CharacterData {
  _id?: string;
  name: string;
  description?: string;
  bodyColor: string;
  flowerColor: string;
  visorColor: string;
  flowerType: string;
}

export const fetchCharacters = async (): Promise<CharacterData[]> => {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export const fetchCharacter = async (id: string): Promise<CharacterData> => {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error('Not found');
  return res.json();
};

export const createCharacter = async (data: Omit<CharacterData, '_id'>): Promise<CharacterData> => {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const updateCharacter = async (id: string, data: Partial<CharacterData>): Promise<CharacterData> => {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const deleteCharacter = async (id: string): Promise<void> => {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
};
```

- [ ] **Step 3: 커밋**

```bash
git add admin/src/api.ts admin/src/utils.ts
git commit -m "feat: add admin API client and color utils"
```

---

## Task 7: Admin 앱 — 3D 미리보기 (preview3d.ts)

**Files:**
- Create: `admin/src/preview3d.ts`

- [ ] **Step 1: `admin/src/preview3d.ts` 생성**

`client/src/game/characterModel.ts` 내용을 기반으로 Three.js 씬 + 캐릭터 + 회전 조작 포함:

```typescript
import * as THREE from 'three';
import { toThreeColor } from './utils';

// ─── characterModel 복사 (admin 전용) ─────────────────────

const createFlowerModel = (flowerColor: number) => {
  const flowerGroup = new THREE.Group();
  const stemSegments: THREE.Mesh[] = [];
  const stemPointCount = 8;
  const stemHeight = 0.8;
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27 });

  for (let i = 0; i < stemPointCount; i++) {
    const t = i / (stemPointCount - 1);
    const segment = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, stemHeight / stemPointCount),
      stemMat
    );
    segment.position.set(0, t * stemHeight, 0);
    flowerGroup.add(segment);
    stemSegments.push(segment);
  }

  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.04), stemMat);
  leaf.scale.set(0.5, 1, 2);
  leaf.position.set(0, 0.2, 0.05);
  leaf.rotation.x = 0.5;
  flowerGroup.add(leaf);

  const flowerHead = new THREE.Group();
  flowerHead.position.set(0, stemHeight, 0);
  flowerHead.rotation.x = 0.4;
  flowerGroup.add(flowerHead);

  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.08),
    new THREE.MeshStandardMaterial({ color: 0xffcc00 })
  );
  center.scale.set(1, 0.6, 1);
  flowerHead.add(center);

  const petalGeo = new THREE.SphereGeometry(0.03, 8, 8);
  petalGeo.scale(1.5, 0.2, 5);
  const petalMat = new THREE.MeshStandardMaterial({ color: flowerColor, roughness: 0.1 });

  for (let i = 0; i < 18; i++) {
    const petal = new THREE.Mesh(petalGeo, petalMat);
    const angle = (i / 18) * Math.PI * 2;
    petal.position.set(Math.cos(angle) * 0.18, 0, Math.sin(angle) * 0.18);
    petal.rotation.y = -angle;
    petal.rotation.z = 0.1;
    flowerHead.add(petal);
  }

  (flowerGroup as any).setPetalColor = (color: number) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.1 });
    flowerHead.children.forEach(c => {
      if (c instanceof THREE.Mesh && c !== center) c.material = mat;
    });
  };

  return flowerGroup;
};

const createCharacterModel = (bodyColor: number, flowerColor: number) => {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.1 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });

  const lowerBody = new THREE.Group();
  const bottomCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 32), whiteMat);
  bottomCyl.position.y = 0.75;
  lowerBody.add(bottomCyl);
  const bottomSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    whiteMat
  );
  bottomSphere.position.y = 0.5;
  lowerBody.add(bottomSphere);
  root.add(lowerBody);

  const upperBody = new THREE.Group();
  upperBody.position.y = 1.0;
  root.add(upperBody);

  const topCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 32), bodyMat);
  topCyl.position.y = 0.25;
  upperBody.add(topCyl);
  const topSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    bodyMat
  );
  topSphere.position.y = 0.5;
  upperBody.add(topSphere);

  const visorGeo = new THREE.BoxGeometry(0.6, 0.15, 0.1);
  let visorMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.2, metalness: 0.1 });
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.4, 0.48);
  upperBody.add(visor);

  const flower = createFlowerModel(flowerColor);
  flower.position.y = 0.6;
  upperBody.add(flower);

  (root as any).setBodyColor = (c: number) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.1 });
    topCyl.material = m;
    topSphere.material = m;
  };
  (root as any).setFlowerColor = (c: number) => {
    if ((flower as any).setPetalColor) (flower as any).setPetalColor(c);
  };
  (root as any).setVisorColor = (c: number) => {
    visor.material = new THREE.MeshStandardMaterial({ color: c, roughness: 0.2, metalness: 0.1 });
  };

  return root;
};

// ─── Preview3D 클래스 ──────────────────────────────────────

export class Preview3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private model: THREE.Group | null = null;
  private animId = 0;

  // 마우스/키 회전 상태
  private isDragging = false;
  private prevMouseX = 0;
  private prevMouseY = 0;
  private rotY = 0;
  private rotX = 0.3;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xA2D2FF);

    this.camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    this.camera.position.set(0, 2, 5);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xb9f3fc, 1.0);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(5, 10, 5);
    this.scene.add(dir);

    this._bindEvents(canvas);
    this._animate();
  }

  loadCharacter(bodyColor: string, flowerColor: string, visorColor: string) {
    if (this.model) this.scene.remove(this.model);
    this.model = createCharacterModel(toThreeColor(bodyColor), toThreeColor(flowerColor));
    (this.model as any).setVisorColor(toThreeColor(visorColor));
    this.model.position.set(0, -1, 0);
    this.scene.add(this.model);
  }

  updateColor(type: 'body' | 'flower' | 'visor', hexColor: string) {
    if (!this.model) return;
    const c = toThreeColor(hexColor);
    if (type === 'body') (this.model as any).setBodyColor(c);
    if (type === 'flower') (this.model as any).setFlowerColor(c);
    if (type === 'visor') (this.model as any).setVisorColor(c);
  }

  private _bindEvents(canvas: HTMLCanvasElement) {
    canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.rotY += (e.clientX - this.prevMouseX) * 0.01;
      this.rotX += (e.clientY - this.prevMouseY) * 0.005;
      this.rotX = Math.max(-0.5, Math.min(1.0, this.rotX));
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
    });
    window.addEventListener('mouseup', () => { this.isDragging = false; });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft')  this.rotY -= 0.05;
      if (e.key === 'ArrowRight') this.rotY += 0.05;
      if (e.key === 'ArrowUp')    this.rotX = Math.max(-0.5, this.rotX - 0.05);
      if (e.key === 'ArrowDown')  this.rotX = Math.min(1.0,  this.rotX + 0.05);
    });
  }

  private _animate = () => {
    this.animId = requestAnimationFrame(this._animate);
    if (this.model) {
      if (!this.isDragging) this.rotY += 0.005; // idle 자동 회전
      this.model.rotation.y = this.rotY;
      this.camera.position.x = Math.sin(this.rotY) * 5;
      this.camera.position.z = Math.cos(this.rotY) * 5;
      this.camera.position.y = 2 + this.rotX * 2;
      this.camera.lookAt(0, 1, 0);
    }
    this.renderer.render(this.scene, this.camera);
  };

  destroy() {
    cancelAnimationFrame(this.animId);
    this.renderer.dispose();
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add admin/src/preview3d.ts
git commit -m "feat: add 3D character preview for admin"
```

---

## Task 8: Admin 앱 — 목록 + 폼 UI 구현

**Files:**
- Create: `admin/src/characterList.ts`, `admin/src/characterForm.ts`
- Modify: `admin/src/main.ts`

- [ ] **Step 1: `admin/src/characterList.ts` 생성**

```typescript
import { CharacterData, deleteCharacter } from './api';

type OnSelect = (char: CharacterData) => void;
type OnNew = () => void;

export const renderList = (
  characters: CharacterData[],
  selectedId: string | null,
  onSelect: OnSelect,
  onNew: OnNew
) => {
  const listEl = document.getElementById('character-list')!;
  const addBtn = document.getElementById('add-btn')!;

  listEl.innerHTML = '';

  if (characters.length === 0) {
    listEl.innerHTML = '<div id="empty-state">캐릭터가 없습니다</div>';
  }

  characters.forEach((char) => {
    const item = document.createElement('div');
    item.className = 'char-item' + (char._id === selectedId ? ' selected' : '');
    item.innerHTML = `
      <span class="char-item-name">● ${char.name}</span>
      <div class="char-item-actions">
        <button class="edit-btn" title="편집">✏️</button>
        <button class="delete-btn" title="삭제">🗑</button>
      </div>
    `;

    item.querySelector('.edit-btn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect(char);
    });

    item.querySelector('.delete-btn')!.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`"${char.name}"을 삭제할까요?`)) return;
      await deleteCharacter(char._id!);
      window.location.reload();
    });

    item.addEventListener('click', () => onSelect(char));
    listEl.appendChild(item);
  });

  addBtn.onclick = onNew;
};
```

- [ ] **Step 2: `admin/src/characterForm.ts` 생성**

```typescript
import { CharacterData, createCharacter, updateCharacter } from './api';
import { Preview3D } from './preview3d';

let preview: Preview3D | null = null;

const defaultChar = (): Omit<CharacterData, '_id'> => ({
  name: '',
  description: '',
  bodyColor: '#FFB7B2',
  flowerColor: '#FFB7B2',
  visorColor: '#333333',
  flowerType: 'daisy',
});

export const renderForm = (char: CharacterData | null, onSaved: () => void) => {
  const container = document.getElementById('form-container')!;
  const data = char ? { ...char } : defaultChar();

  container.innerHTML = `
    <h2 style="margin-bottom:20px;font-size:16px;">${char ? '캐릭터 편집' : '새 캐릭터'}</h2>
    <div class="form-group">
      <label>이름 *</label>
      <input id="f-name" type="text" maxlength="20" value="${data.name}" placeholder="캐릭터 이름 (최대 20자)" />
    </div>
    <div class="form-group">
      <label>설명</label>
      <input id="f-desc" type="text" maxlength="100" value="${data.description || ''}" placeholder="설명 (최대 100자)" />
    </div>
    <div class="form-group">
      <label>바디 컬러</label>
      <input id="f-body" type="color" value="${data.bodyColor}" />
    </div>
    <div class="form-group">
      <label>꽃 컬러</label>
      <input id="f-flower" type="color" value="${data.flowerColor}" />
    </div>
    <div class="form-group">
      <label>바이저 색</label>
      <input id="f-visor" type="color" value="${data.visorColor}" />
    </div>
    <div class="form-group">
      <label>꽃 종류</label>
      <select id="f-type">
        <option value="daisy" ${data.flowerType === 'daisy' ? 'selected' : ''}>Daisy (데이지)</option>
      </select>
    </div>
    <canvas id="preview-canvas"></canvas>
    <div class="form-actions">
      <button id="save-btn">저장</button>
      <button id="cancel-btn">취소</button>
    </div>
  `;

  // 3D 미리보기 초기화
  const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
  canvas.width = canvas.clientWidth || 400;
  canvas.height = 220;
  if (preview) preview.destroy();
  preview = new Preview3D(canvas);
  preview.loadCharacter(data.bodyColor, data.flowerColor, data.visorColor);

  // 색상 실시간 반영
  document.getElementById('f-body')!.addEventListener('input', (e) => {
    preview?.updateColor('body', (e.target as HTMLInputElement).value);
  });
  document.getElementById('f-flower')!.addEventListener('input', (e) => {
    preview?.updateColor('flower', (e.target as HTMLInputElement).value);
  });
  document.getElementById('f-visor')!.addEventListener('input', (e) => {
    preview?.updateColor('visor', (e.target as HTMLInputElement).value);
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
    container.innerHTML = '<p style="color:#aaa;padding:20px;">좌측에서 캐릭터를 선택하세요.</p>';
    if (preview) { preview.destroy(); preview = null; }
  });
};
```

- [ ] **Step 3: `admin/src/main.ts` 업데이트**

```typescript
import { fetchCharacters, CharacterData } from './api';
import { renderList } from './characterList';
import { renderForm } from './characterForm';

let characters: CharacterData[] = [];
let selectedId: string | null = null;

const refresh = async () => {
  characters = await fetchCharacters();
  renderList(characters, selectedId, onSelect, onNew);
};

const onSelect = (char: CharacterData) => {
  selectedId = char._id ?? null;
  renderList(characters, selectedId, onSelect, onNew);
  renderForm(char, async () => { await refresh(); });
};

const onNew = () => {
  selectedId = null;
  renderList(characters, selectedId, onSelect, onNew);
  renderForm(null, async () => { await refresh(); });
};

refresh();
```

- [ ] **Step 4: Admin 앱 통합 테스트**

서버와 Admin 앱 동시 실행:
```bash
# 터미널 1
cd server && npm run dev

# 터미널 2
cd admin && npm run dev
```

http://localhost:5174 에서:
1. "새 캐릭터" 버튼 클릭 → 폼 열림
2. 이름/색상 입력 → 3D 미리보기 실시간 반영
3. 저장 → 목록에 표시
4. 편집/삭제 동작 확인

- [ ] **Step 5: 커밋**

```bash
git add admin/src/
git commit -m "feat: implement admin character list and form UI"
```

---

## Task 9: client toThreeColor 유틸 추가

**Files:**
- Create: `client/src/utils.ts`

- [ ] **Step 1: `client/src/utils.ts` 생성**

```typescript
/** hex 문자열 "#FFB7B2" → Three.js 숫자 0xFFB7B2 */
export const toThreeColor = (hex: string): number =>
  parseInt(hex.replace('#', ''), 16);
```

- [ ] **Step 2: 커밋**

```bash
git add client/src/utils.ts
git commit -m "feat: add toThreeColor utility for client"
```

---

## Task 10: client — 캐릭터 선택 화면 구현

**Files:**
- Create: `client/src/ui/characterSelect.ts`
- Modify: `client/src/main.ts`

- [ ] **Step 1: `client/src/ui/characterSelect.ts` 생성**

```typescript
import * as THREE from 'three';
import { createCharacterModel } from '../game/characterModel';
import { toThreeColor } from '../utils';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

export interface CharacterSelection {
  playerName: string;
  characterId: string;
  bodyColor: string;
  flowerColor: string;
  visorColor: string;
  flowerType: string;
}

interface CharacterData {
  _id: string;
  name: string;
  description?: string;
  bodyColor: string;
  flowerColor: string;
  visorColor: string;
  flowerType: string;
}

const renderSnapshot = (char: CharacterData): Promise<string> => {
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

    const model = createCharacterModel(toThreeColor(char.bodyColor), toThreeColor(char.flowerColor));
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
      // 순차적으로 스냅샷 생성 후 카드 표시
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
        });
      }, 400);
    });
  });
};
```

- [ ] **Step 2: `client/src/main.ts` 변경**

`showNameInput` import를 `showCharacterSelect`로 교체:

```typescript
// 변경 전
import { showNameInput } from './ui/nameInput';

// 변경 후
import { showCharacterSelect } from './ui/characterSelect';
```

하단 게임 시작 블록 변경:

```typescript
// 변경 전
showNameInput().then((name) => {
  const myTag = createNameTag(name);
  myTag.name = 'nameTag';
  playerMesh.add(myTag);
  connectWithName(name);
  animate();
});

// 변경 후
showCharacterSelect().then((selection) => {
  const myTag = createNameTag(selection.playerName);
  myTag.name = 'nameTag';
  playerMesh.add(myTag);
  connectWithCharacter(selection);
  animate();
});
```

- [ ] **Step 3: 커밋**

```bash
git add client/src/ui/characterSelect.ts client/src/main.ts
git commit -m "feat: replace name input with character selection screen"
```

---

## Task 11: player.ts — setPlayerColor visorColor 지원 추가

**Files:**
- Modify: `client/src/game/player.ts`

- [ ] **Step 1: setPlayerColor 시그니처에 visorColor 추가**

`client/src/game/player.ts`에서 `setPlayerColor` 함수를 찾아 교체:

```typescript
export const setPlayerColor = (bodyColor: number, flowerColor: number, visorColor?: number) => {
  localBodyColor = bodyColor;
  if ((characterModel as any).setBodyColor) {
    (characterModel as any).setBodyColor(bodyColor);
  }
  if ((characterModel as any).setFlowerColor) {
    (characterModel as any).setFlowerColor(flowerColor);
  }
  if (visorColor !== undefined && (characterModel as any).setVisorColor) {
    (characterModel as any).setVisorColor(visorColor);
  }
};
```

- [ ] **Step 2: 커밋**

```bash
git add client/src/game/player.ts
git commit -m "feat: extend setPlayerColor to support visorColor"
```

---

## Task 12: client socket — connectWithCharacter 추가 및 색상 변환 적용

**Files:**
- Modify: `client/src/network/socket.ts`

- [ ] **Step 1: 상단 import 블록에 추가**

`client/src/network/socket.ts` 파일 상단 기존 import 블록 끝에 아래 두 줄 추가:

```typescript
import { toThreeColor } from '../utils';
import type { CharacterSelection } from '../ui/characterSelect';
```

- [ ] **Step 2: `connectWithName` 함수를 `connectWithCharacter`로 교체**

아래 기존 코드를 찾아서:
```typescript
export const connectWithName = (name: string) => {
  localPlayerName = name;
  socket.auth = { playerName: name };
  socket.connect();
};
```

아래로 교체:
```typescript
export const connectWithCharacter = (selection: CharacterSelection) => {
  localPlayerName = selection.playerName;
  socket.auth = {
    playerName: selection.playerName,
    characterId: selection.characterId,
    bodyColor: selection.bodyColor,
    flowerColor: selection.flowerColor,
    visorColor: selection.visorColor,
    flowerType: selection.flowerType,
  };
  socket.connect();
};
```

- [ ] **Step 3: `PLAYER_NAME` 리스너 제거**

아래 블록 전체 삭제 (서버가 더 이상 이 이벤트를 발행하지 않음):
```typescript
// 다른 플레이어 이름 수신 → 이름표 교체
socket.on('PLAYER_NAME', (data: { id: string, name: string }) => {
  if (otherPlayers[data.id]) {
    if (nameTags[data.id]) otherPlayers[data.id].remove(nameTags[data.id]);
    const tag = createNameTag(data.name);
    otherPlayers[data.id].add(tag);
    nameTags[data.id] = tag;
  }
});
```

- [ ] **Step 4: `addOtherPlayer` 함수 시그니처를 hex 문자열로 변경**

기존 함수:
```typescript
function addOtherPlayer(id: string, initialPos: {x: number, y: number, z: number}, bodyColor: number = 0xffb7b2, _flowerColor: number = 0xffd1dc, name: string = '익명') {
  if(otherPlayers[id]) return;

  setRemotePlayerColor(id, bodyColor);

  const model = createCharacterModel(bodyColor, bodyColor);
  model.position.set(initialPos.x, initialPos.y, initialPos.z);
  model.userData = { playerId: id };

  const tag = createNameTag(name);
  model.add(tag);
  nameTags[id] = tag;

  scene.add(model);
  otherPlayers[id] = model;
}
```

아래로 교체:
```typescript
function addOtherPlayer(
  id: string,
  initialPos: { x: number; y: number; z: number },
  bodyColor: string = '#FFB7B2',
  flowerColor: string = '#FFB7B2',
  visorColor: string = '#333333',
  name: string = '익명'
) {
  if (otherPlayers[id]) return;

  const bodyNum = toThreeColor(bodyColor);
  const flowerNum = toThreeColor(flowerColor);
  const visorNum = toThreeColor(visorColor);

  setRemotePlayerColor(id, bodyNum);

  const model = createCharacterModel(bodyNum, flowerNum);
  if ((model as any).setVisorColor) (model as any).setVisorColor(visorNum);
  model.position.set(initialPos.x, initialPos.y, initialPos.z);
  model.userData = { playerId: id };

  const tag = createNameTag(name);
  model.add(tag);
  nameTags[id] = tag;

  scene.add(model);
  otherPlayers[id] = model;
}
```

- [ ] **Step 5: `current_players` 핸들러 업데이트**

기존 핸들러를 찾아 교체:
```typescript
socket.on('current_players', (players: Record<string, any>) => {
  for (const id in players) {
    if (id !== socket.id) {
      addOtherPlayer(
        id,
        players[id].position,
        players[id].bodyColor,
        players[id].flowerColor,
        players[id].visorColor,
        players[id].name
      );
    } else {
      console.log(`[Socket] Setting local player info: Body=${players[id].bodyColor}, HP=${players[id].hp}`);
      setPlayerColor(
        toThreeColor(players[id].bodyColor),
        toThreeColor(players[id].flowerColor),
        toThreeColor(players[id].visorColor)
      );
      if (players[id].hp !== undefined) {
        import('../game/player').then(m => m.applyDamage(players[id].hp));
      }
    }
  }
});
```

- [ ] **Step 6: `player_joined` 핸들러 업데이트**

기존 핸들러를 찾아 교체:
```typescript
socket.on('player_joined', (playerData: any) => {
  addOtherPlayer(
    playerData.id,
    playerData.position,
    playerData.bodyColor,
    playerData.flowerColor,
    playerData.visorColor,
    playerData.name
  );
});
```

- [ ] **Step 7: 커밋**

```bash
git add client/src/network/socket.ts
git commit -m "feat: replace connectWithName with connectWithCharacter, apply hex color sync"
```

---

## Task 13: client main.ts — import 정리 및 connectWithCharacter 연결

**Files:**
- Modify: `client/src/main.ts`

- [ ] **Step 1: main.ts import 블록 업데이트**

`client/src/main.ts` 상단에서 아래 두 줄을 찾아:
```typescript
import { broadcastLocalPosition, sendChatMessage, sendShoot, connectWithName } from './network/socket';
...
import { showNameInput } from './ui/nameInput';
```

아래로 교체:
```typescript
import { broadcastLocalPosition, sendChatMessage, sendShoot, connectWithCharacter } from './network/socket';
...
import { showCharacterSelect } from './ui/characterSelect';
```

- [ ] **Step 2: 게임 시작 블록 교체**

파일 하단의 아래 블록을 찾아:
```typescript
showNameInput().then((name) => {
  const myTag = createNameTag(name);
  myTag.name = 'nameTag';
  playerMesh.add(myTag);
  connectWithName(name);
  animate();
});
```

아래로 교체:
```typescript
showCharacterSelect().then((selection) => {
  const myTag = createNameTag(selection.playerName);
  myTag.name = 'nameTag';
  playerMesh.add(myTag);
  connectWithCharacter(selection);
  animate();
});
```

- [ ] **Step 3: 전체 통합 테스트**

터미널 1: `cd server && npm run dev`
터미널 2: `cd client && npm run dev`

1. http://localhost:5173 접속
2. 캐릭터 선택 화면 표시 확인 (카드 목록 렌더링)
3. 이름 입력 + 카드 클릭 → [게임 시작] 활성화 확인
4. 게임 시작 → 선택한 색상/바이저로 캐릭터 렌더링 확인
5. 두 번째 탭 열어서 다른 캐릭터 선택 → 상대방 색상 정확히 표시 확인

- [ ] **Step 4: 커밋**

```bash
git add client/src/main.ts
git commit -m "feat: wire character selection into game entry point"
```

---

## Task 14: README 업데이트 및 Admin 실행 방법 추가

**Files:**
- Modify: `SESSION_SUMMARY.md` (또는 README가 있다면 거기에)

- [ ] **Step 1: SESSION_SUMMARY.md 상단에 세션 요약 추가**

```bash
# 관련 스킬 사용
# /session-log 로 업데이트
```

- [ ] **Step 2: 최종 커밋**

```bash
git add .
git commit -m "docs: update session summary for character admin feature"
```
