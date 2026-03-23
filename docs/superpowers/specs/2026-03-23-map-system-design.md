# 맵 시스템 설계 스펙 — 2026-03-23

## 개요

캐릭터 시스템과 동일한 패턴으로 맵 생성/관리 시스템을 구축한다.
어드민에서 맵을 DB에 등록하고, 게임 로비에서 플레이어가 맵(=방)을 선택해 입장한다.
같은 맵을 선택한 플레이어끼리 Socket.IO 룸으로 묶인다.

---

## 1. 전체 아키텍처

```
[어드민 사이트 (포트 81)]
  /characters  — 기존 캐릭터 관리
  /maps        — 신규 맵 관리 (CRUD)
        ↓ REST API
[서버 /api/maps]
        ↓ MySQL (twdb, 220.85.41.214)
  maps 테이블
        ↑ 조회
[게임 클라이언트]
  캐릭터 선택 오버레이 (기존) → 맵 로비 오버레이 (신규)
        ↓ socket.connect({ auth: { characterData } })
        ↓ Socket.IO: JOIN_MAP { mapId }
[서버 Socket.IO]
  socket.join(mapId) → 룸별 브로드캐스트
        ↓ MAP_CONFIG 전송 (DB 값)
[게임 클라이언트]
  DB 값으로 3D 맵 동적 생성 → 게임 루프 시작
```

### main.ts 시작 흐름 (변경 후)

```
1. showCharacterSelect()         — 캐릭터/이름 선택 (기존)
2. connectWithCharacter(auth)    — 소켓 연결 (캐릭터 auth 포함)
3. fetchMapList() → showLobby()  — REST로 맵 목록 조회 후 로비 표시
4. 플레이어가 맵 선택
5. emit('JOIN_MAP', { mapId })
6. on('MAP_CONFIG', config) → initWorld(config)
7. on('current_players', ...) → 원격 플레이어 렌더링
8. animate()                     — 게임 루프 시작
```

- `MAP_CONFIG`는 반드시 `current_players` 보다 먼저 처리되어야 한다.
  서버는 `JOIN_MAP` 핸들러에서 `MAP_CONFIG` 를 먼저 emit한 후 `current_players` 를 emit한다.
- 소켓은 캐릭터 선택 완료 직후 연결되므로 `JOIN_MAP` 페이로드에 캐릭터 데이터는 포함하지 않는다.
  캐릭터 데이터는 기존과 동일하게 `socket.handshake.auth` 를 통해 전달된다.

---

## 2. DB 스키마

```sql
CREATE TABLE maps (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  theme          VARCHAR(50)  NOT NULL,        -- 'pastel' | 'candy' | 'neon' | 'custom'
  floor_size     INT          DEFAULT 400,
  play_zone      INT          DEFAULT 80,       -- 장애물 배치 반경 (±play_zone 유닛, 반경값)
  obstacle_count INT          DEFAULT 80,
  obstacle_colors JSON        NOT NULL,         -- 최소 1개 이상의 hex 색상 배열 ["#FFADAD", ...]
  fog_density    FLOAT        DEFAULT 0.005,
  bg_color       VARCHAR(7)   DEFAULT '#A2D2FF',
  seed           INT          DEFAULT 42,       -- 유효 범위: 0 ~ 2147483647
  is_active      BOOLEAN      DEFAULT TRUE,
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
```

**참고:** `play_zone`은 반경(half-extent)값이다. 장애물 배치 범위는 `[-play_zone, +play_zone]`.
`obstacle_colors`는 빈 배열 불허; 서버에서 최소 1개 검증 필요.
테이블 생성은 서버 시작 시 기존 `ensureTable` 패턴으로 자동 생성.

---

## 3. 서버 룸 시스템

### Socket.IO 룸 변경
- 기존: 전체 브로드캐스트 (`socket.broadcast.emit`)
- 변경: 맵별 룸 브로드캐스트 (`socket.to(player.mapId).emit`)

### 신규 이벤트
| 이벤트 | 방향 | 데이터 | 설명 |
|---|---|---|---|
| `JOIN_MAP` | 클→서버 | `{ mapId: number }` | 소켓 연결 후 맵 선택 시 |
| `MAP_CONFIG` | 서버→클 | MapConfig 객체 | DB 맵 설정 (current_players보다 먼저 emit) |
| `MAP_PLAYERS` | 서버→클 | `{ [mapId]: count }` | 맵별 접속자 수; JOIN_MAP/disconnect 시 전체 push |

### MAP_PLAYERS 발행 시점
`MAP_PLAYERS`는 서버가 전체 미입장 소켓(로비 상태)에게 push하는 방식.
발행 트리거: `JOIN_MAP` 수신 시, 소켓 disconnect 시.
로비 소켓은 `JOIN_MAP`을 아직 수신하지 않은 소켓으로 정의한다.
구현 시 `io.emit()`으로 전체 전송하거나 별도 `'lobby'` 룸을 유지하는 방식을 선택할 수 있다.

### 기존 이벤트 변경
모든 게임 이벤트(`MOVE`, `SHOOT`, `TAKE_DAMAGE`, `PLAYER_DAMAGED`, `PLAYER_RESPAWN`)를
`socket.broadcast.emit` → `socket.to(player.mapId).emit` 으로 변경.
`player_joined`도 connection 시점이 아닌 `JOIN_MAP` 수신 후 해당 맵 룸에만 emit한다.

**추가:** 힐(회복) 인터벌도 동일 맵(`p1.mapId === p2.mapId`) 플레이어 간에만 적용.

### 맵 전환 (이번 범위 외)
`LEAVE_MAP` 이벤트 및 맵 재선택은 이번 구현 범위 밖이다.
플레이어가 다른 맵으로 이동하려면 페이지를 새로고침해야 한다.

### MapConfig 타입
```typescript
interface MapConfig {
  id: number;
  name: string;
  theme: string;
  floorSize: number;
  playZone: number;      // 반경값 (장애물 범위: ±playZone)
  obstacleCount: number;
  obstacleColors: string[];
  fogDensity: number;
  bgColor: string;
  seed: number;
}
```

---

## 4. REST API

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/maps` | 활성 맵 목록 (is_active=true), 로비에서 사용 |
| GET | `/api/maps/:id` | 맵 상세 조회 |
| POST | `/api/maps` | 맵 생성 |
| PUT | `/api/maps/:id` | 맵 수정 |
| DELETE | `/api/maps/:id` | 맵 비활성화 (is_active=false); 현재 입장 플레이어가 있어도 안전 |

**DELETE 정책:** 하드 삭제 금지. `is_active = false` 로 소프트 삭제만 허용.
이미 입장한 플레이어는 세션이 끝날 때까지 기존 맵 유지.

**POST/PUT 검증:**
- `name`: 필수, 비어있으면 400
- `obstacle_colors`: 필수, 배열이며 최소 1개 이상이어야 함
- `seed`: 0 ~ 2147483647 범위
- `fog_density`: 0.001 ~ 0.05 범위

---

## 5. 어드민 UI (/maps)

캐릭터 어드민과 동일한 패턴으로 구현.

### 신규 파일
```
admin/src/
  ├── mapList.ts     (맵 목록 화면 — characterList.ts 패턴 참고)
  ├── mapForm.ts     (생성/수정 폼 — characterForm.ts 패턴 참고)
  └── mapApi.ts      (REST 호출 — characterApi.ts 패턴 참고)
```

### 목록 화면
- 맵 목록 테이블: 이름, 테마, 장애물 수, 활성 여부, 수정/비활성화 버튼

### 생성/수정 폼
| 필드 | 입력 타입 | 설명 |
|---|---|---|
| 맵 이름 | text | 로비에 표시될 이름 |
| 테마 | select | pastel / candy / neon / custom |
| 장애물 수 | range (10~200) | 슬라이더 |
| 컬러 팔레트 | color picker 배열 | 색상 추가/제거; 최소 1개 필수 |
| 바닥 크기 | number | 기본 400 |
| 안개 밀도 | number (0.001~0.05) | 기본 0.005 |
| 배경색 | color picker | 기본 #A2D2FF |
| 시드값 | number (0~2147483647) + 랜덤 버튼 | 맵 고유 시드 |
| 활성 여부 | toggle | 비활성 시 로비에 미표시 |

---

## 6. 게임 클라이언트

### 로비 오버레이 (`client/src/ui/lobby.ts`)

캐릭터 선택 완료 후 소켓 연결 → `GET /api/maps` 호출 → 로비 표시:
- 맵 목록 + 맵별 접속자 수 (`MAP_PLAYERS` 수신 시 실시간 갱신)
- 맵 선택 후 "입장하기" 버튼 → `JOIN_MAP { mapId }` 전송
- `MAP_CONFIG` 수신 시 로비 오버레이 제거 → `initWorld(config)` 호출

```
┌──────────────────────────────┐
│         맵 선택               │
│                              │
│  Pastel Garden    👥 3명      │
│  Candy Land       👥 0명      │
│  Neon City        👥 5명      │
│                              │
│         [ 입장하기 ]           │
└──────────────────────────────┘
```

### 동적 맵 생성 (`client/src/game/world.ts`)

`initWorld(config: MapConfig)` 시그니처로 변경:
- 기존 하드코딩 값을 MapConfig 파라미터로 교체
- `seededRandom(config.seed)` 로 장애물 위치 결정
- 장애물 배치 범위: `[-config.playZone, +config.playZone]`
- `config.obstacleColors` 배열에서 색상 선택
- `config.fogDensity`, `config.bgColor` 등 적용

### 파일 변경 목록
| 파일 | 변경 |
|---|---|
| `client/src/game/world.ts` | `initWorld(config: MapConfig)` 로 리팩터 |
| `client/src/ui/lobby.ts` | 신규 — 맵 로비 오버레이 |
| `client/src/network/socket.ts` | `JOIN_MAP`, `MAP_CONFIG`, `MAP_PLAYERS` 이벤트 추가 |
| `client/src/main.ts` | 캐릭터 선택 → 소켓 연결 → 로비 → `initWorld` 순서로 재구성 |
| `server/src/index.ts` | 룸 시스템, `JOIN_MAP`/`MAP_CONFIG` 처리, 힐 인터벌 룸 필터 추가 |
| `server/src/models/Map.ts` | 신규 — `ensureTable` 패턴 (Character.ts 참고) |
| `server/src/routes/maps.ts` | 신규 — REST API 라우트 (characters.ts 패턴 참고) |
| `admin/src/mapList.ts` | 신규 |
| `admin/src/mapForm.ts` | 신규 |
| `admin/src/mapApi.ts` | 신규 |
| `admin/src/main.ts` | 맵 관리 페이지 라우팅 추가 |

---

## 7. 구현 순서

1. DB 테이블 생성 (`maps`) — `ensureTable` 패턴으로 서버 시작 시 자동 생성
2. 서버 `/api/maps` REST API + 입력 검증
3. 어드민 `/maps` UI (mapList, mapForm, mapApi)
4. 서버 Socket.IO: `JOIN_MAP` → `MAP_CONFIG` + `current_players` 순서 보장, 룸 브로드캐스트
5. 서버 힐 인터벌 룸 필터 적용
6. 게임 클라이언트 로비 오버레이 (`lobby.ts`)
7. `world.ts` → `initWorld(config)` 리팩터
8. `main.ts` 시작 흐름 재구성
9. Candy Land 기본 맵 데이터 DB 삽입

---

## 8. 제약 조건

- DB: 원격 MySQL (220.85.41.214:3306, twdb); `ensureTable` 자동 생성 사용
- 시드 기반 생성 유지 → 모든 클라이언트 동일한 맵 렌더링
- 기존 캐릭터 시스템 코드 패턴 준수
- 신규 맵 추가 = DB에 레코드 추가만으로 완료 (코드 변경 불필요)
- 맵 전환(방 이동)은 이번 범위 밖; 재입장은 페이지 새로고침으로 처리
