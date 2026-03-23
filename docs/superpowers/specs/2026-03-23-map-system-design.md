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
  로비 오버레이: 맵 목록 표시 → 선택
        ↓ Socket.IO: JOIN_MAP { mapId, playerName }
[서버 Socket.IO]
  socket.join(mapId) → 룸별 브로드캐스트
        ↓ MAP_CONFIG 전송 (DB 값)
[게임 클라이언트]
  DB 값으로 3D 맵 동적 생성
```

---

## 2. DB 스키마

```sql
CREATE TABLE maps (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  theme          VARCHAR(50)  NOT NULL,        -- 'pastel' | 'candy' | 'neon' | 'custom'
  floor_size     INT          DEFAULT 400,
  play_zone      INT          DEFAULT 80,       -- 플레이 가능 반경 (±play_zone)
  obstacle_count INT          DEFAULT 80,
  obstacle_colors JSON        NOT NULL,         -- ["#FFADAD", "#FFD6A5", ...]
  fog_density    FLOAT        DEFAULT 0.005,
  bg_color       VARCHAR(7)   DEFAULT '#A2D2FF',
  seed           INT          DEFAULT 42,
  is_active      BOOLEAN      DEFAULT TRUE,
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. 서버 룸 시스템

### Socket.IO 룸 변경
- 기존: 전체 브로드캐스트 (`io.emit`)
- 변경: 맵별 룸 브로드캐스트 (`io.to(mapId).emit`)

### 신규 이벤트
| 이벤트 | 방향 | 데이터 | 설명 |
|---|---|---|---|
| `JOIN_MAP` | 클→서버 | `{ mapId, playerName }` | 맵 선택 후 입장 |
| `MAP_CONFIG` | 서버→클 | MapConfig 객체 | DB에서 읽은 맵 설정 |
| `MAP_PLAYERS` | 서버→클 | `{ mapId: count }` | 맵별 접속자 수 (로비용) |

### 기존 이벤트 변경
모든 게임 이벤트(`MOVE`, `SHOOT`, `TAKE_DAMAGE`, `PLAYER_DAMAGED`, `PLAYER_RESPAWN`)를
`socket.broadcast.emit` → `socket.to(mapId).emit` 으로 변경.

### MapConfig 타입
```typescript
interface MapConfig {
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
}
```

---

## 4. REST API

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/maps` | 활성 맵 목록 (is_active=true) |
| GET | `/api/maps/:id` | 맵 상세 조회 |
| POST | `/api/maps` | 맵 생성 |
| PUT | `/api/maps/:id` | 맵 수정 |
| DELETE | `/api/maps/:id` | 맵 삭제 |

---

## 5. 어드민 UI (/maps)

캐릭터 어드민과 동일한 패턴으로 구현.

### 목록 화면
- 맵 목록 테이블: 이름, 테마, 장애물 수, 활성 여부, 수정/삭제 버튼

### 생성/수정 폼
| 필드 | 입력 타입 | 설명 |
|---|---|---|
| 맵 이름 | text | 로비에 표시될 이름 |
| 테마 | select | pastel / candy / neon / custom |
| 장애물 수 | range (10~200) | 슬라이더 |
| 컬러 팔레트 | color picker 배열 | 색상 추가/제거 가능 |
| 바닥 크기 | number | 기본 400 |
| 안개 밀도 | number (0.001~0.05) | 기본 0.005 |
| 배경색 | color picker | 기본 #A2D2FF |
| 시드값 | number + 랜덤 버튼 | 맵 고유 시드 |
| 활성 여부 | toggle | 비활성 시 로비에 미표시 |

---

## 6. 게임 클라이언트

### 로비 오버레이 (`client/src/ui/lobby.ts`)

접속 시 게임 캔버스 위에 오버레이 표시:
- 서버에서 받은 맵 목록과 맵별 접속자 수 표시
- 플레이어 이름 입력 (기존 SET_NAME 통합)
- 맵 선택 후 "입장하기" 버튼 → `JOIN_MAP` 전송

```
┌──────────────────────────────┐
│         맵 선택               │
│                              │
│  Pastel Garden    👥 3명      │
│  Candy Land       👥 0명      │
│  Neon City        👥 5명      │
│                              │
│  이름: [____________]         │
│                              │
│         [ 입장하기 ]           │
└──────────────────────────────┘
```

### 동적 맵 생성 (`client/src/game/world.ts`)

`MAP_CONFIG` 수신 후 DB 값으로 3D 맵 생성:
- 기존 하드코딩 값을 MapConfig 파라미터로 교체
- `seededRandom(config.seed)` 로 장애물 위치 결정
- `config.obstacleColors` 배열에서 색상 선택
- `config.fogDensity`, `config.bgColor` 등 적용

### 파일 변경 목록
| 파일 | 변경 |
|---|---|
| `client/src/game/world.ts` | MapConfig 파라미터 수용으로 리팩터 |
| `client/src/ui/lobby.ts` | 신규 — 로비 오버레이 |
| `client/src/network/socket.ts` | JOIN_MAP, MAP_CONFIG 이벤트 추가 |
| `client/src/main.ts` | 로비 표시 후 게임 시작 흐름 변경 |
| `server/src/index.ts` | 룸 시스템, MAP_SELECT 처리 추가 |
| `admin/` | /maps CRUD 페이지 추가 |

---

## 7. 구현 순서

1. DB 테이블 생성 (`maps`)
2. 서버 `/api/maps` REST API
3. 어드민 `/maps` UI
4. 서버 Socket.IO 룸 시스템 + `JOIN_MAP` / `MAP_CONFIG` 이벤트
5. 게임 클라이언트 로비 오버레이
6. `world.ts` 동적 맵 생성 리팩터
7. 기존 이벤트 룸 기반으로 변경
8. Candy Land 기본 맵 데이터 DB 삽입

---

## 8. 제약 조건

- DB: 원격 MySQL (220.85.41.214:3306, twdb)
- 시드 기반 생성 유지 → 모든 클라이언트 동일한 맵 렌더링
- 기존 캐릭터 시스템 코드 패턴 준수
- 신규 맵 추가 = DB에 레코드 추가만으로 완료 (코드 변경 불필요)
