# 몬스터 관리 어드민 설계 스펙 — 2026-04-10

## 개요

맵/캐릭터 관리와 동일한 패턴으로 몬스터를 DB에서 관리한다.
어드민에서 몬스터 GLB 파일, 체력, 이동속도, 크기, 효과음을 등록하고,
나중에 맵 어드민에서 해당 맵에 어떤 몬스터를 사용할지 연결한다.

---

## 1. 전체 아키텍처

```
[어드민 사이트 (포트 81)]
  /monsters  — 신규 몬스터 관리 (CRUD + 파일 업로드)
        ↓ REST API
[서버 /api/monsters]
  POST /api/monsters/upload  — GLB·사운드 파일 업로드 (multer)
  GET  /api/monsters/all     — 전체 목록 (어드민용)
  GET  /api/monsters         — 활성 목록 (게임용 / 맵 선택 시)
  POST /api/monsters         — 몬스터 생성
  PUT  /api/monsters/:id     — 몬스터 수정
  DELETE /api/monsters/:id   — 비활성화 (soft delete)
        ↓ MySQL (220.85.41.214)
  monsters 테이블
        ↑ 조회
[게임 클라이언트 monster.ts]
  GLTFLoader로 GLB 로드 → AnimationMixer로 애니메이션
  체력/속도 → 서버에서 Monster 스폰 시 전달
```

---

## 2. DB 테이블 (`monsters`)

```sql
CREATE TABLE IF NOT EXISTS monsters (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  glb_file     VARCHAR(200) NOT NULL,
  hp           INT          DEFAULT 100,
  speed        FLOAT        DEFAULT 3.0,
  scale        FLOAT        DEFAULT 1.0,
  move_sound   VARCHAR(200) DEFAULT NULL,
  attack_sound VARCHAR(200) DEFAULT NULL,
  is_active    BOOLEAN      DEFAULT TRUE,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
```

---

## 3. 파일 업로드

- 업로드 경로: `server/public/uploads/monsters/`
- 정적 서빙: `GET /uploads/monsters/{filename}`
- 파일명 충돌 방지: `Date.now() + '-' + originalname`
- 허용 확장자: GLB(`.glb`), 사운드(`.mp3`, `.ogg`, `.wav`)
- 패키지: `multer` + `@types/multer`

### 업로드 흐름

```
[어드민 폼] 파일 선택
    → POST /api/monsters/upload (multipart/form-data)
    → { filename: "1712345678-slime.glb" } 반환
    → glbFile 필드에 저장
    → POST /api/monsters (JSON) 로 최종 저장
```

---

## 4. MonsterData 인터페이스

```typescript
// admin/src/monsterApi.ts
export interface MonsterData {
  id?: number;
  name: string;          // 몬스터 이름
  glbFile: string;       // GLB 파일명 (ex: "slime.glb")
  hp: number;            // 체력 (기본값 100)
  speed: number;         // 이동속도 (기본값 3.0)
  scale: number;         // 크기 배율 (기본값 1.0)
  moveSound?: string;    // 이동 효과음 파일명
  attackSound?: string;  // 울음/공격 효과음 파일명
  isActive: boolean;
}
```

---

## 5. 어드민 UI

### 폼 필드

| 필드 | 입력 타입 | 범위/기본값 |
|------|-----------|-------------|
| name | text | 필수 |
| glbFile | 파일 업로드 버튼 | `.glb` |
| hp | number | 1~10000, 기본 100 |
| speed | range + 숫자 표시 | 0.5~10.0, 기본 3.0 |
| scale | range + 숫자 표시 | 0.1~5.0, 기본 1.0 |
| moveSound | 파일 업로드 버튼 | `.mp3/.ogg/.wav` |
| attackSound | 파일 업로드 버튼 | `.mp3/.ogg/.wav` |
| isActive | toggle checkbox | 기본 true |

### 레이아웃

- 기존 캐릭터/맵 탭과 동일한 좌우 분할 레이아웃
- 좌: 몬스터 리스트 (스크롤)
- 우: 등록/수정 폼
- 파일 업로드 성공 시 현재 파일명 표시

---

## 6. `server/src/index.ts` 수정

```typescript
// import 추가
import { ensureTable as ensureMonsterTable } from './models/Monster.js';
import monsterRoutes from './routes/monsters.js';
import path from 'path';

// static 파일 서빙 추가
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// ensureTable 호출 (기존 Monster/Map 초기화 이후)
await ensureMonsterTable();

// 라우터 등록
app.use('/api/monsters', monsterRoutes);
```

---

## 7. `admin/src/main.ts` 수정

탭 타입에 `'monsters'` 추가:

```typescript
const showTab = (tab: 'characters' | 'maps' | 'terms' | 'monsters') => { ... }
```

기존 탭과 동일한 패턴으로 `loadMonsters`, `onSelectMonster`, `onNewMonster` 추가.

`index.html`에 탭 버튼 및 섹션 추가:

```html
<button id="tab-monsters">몬스터 관리</button>
<section id="monsters-section" style="display:none">
  <div id="monster-list-container"></div>
  <div id="monster-form-container"></div>
</section>
```

---

## 8. 맵-몬스터 연결 (향후 작업)

이번 작업에서는 구현하지 않음. 이후 맵 어드민에서:
- `MapData`에 `monsterId?: number` 필드 추가
- 맵 폼에 드롭다운으로 활성 몬스터 목록 표시
- 서버에서 맵 스폰 시 해당 몬스터 설정 적용

---

## 9. 참고 파일

| 참고 | 역할 |
|------|------|
| `server/src/models/Map.ts` | DB 모델 패턴 |
| `server/src/routes/maps.ts` | REST API 패턴 |
| `admin/src/mapApi.ts` | 프론트 API 클라이언트 패턴 |
| `admin/src/mapList.ts` | 리스트 UI 패턴 |
| `admin/src/mapForm.ts` | 폼 UI 패턴 (Tailwind 스타일 포함) |
| `admin/src/main.ts` | 탭 전환 패턴 |
| `client/src/game/monster.ts` | 현재 GLTFLoader + AnimationMixer 구현 |
