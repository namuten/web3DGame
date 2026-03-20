# Character Admin System — Design Spec

**Date:** 2026-03-20
**Status:** Approved
**Topic:** 관리자 캐릭터 생성 시스템 + 게임 시작 시 캐릭터 선택

---

## 1. 개요

관리자가 별도 웹 앱에서 캐릭터 프리셋을 생성/관리하고, MongoDB에 저장한다.
게임 사용자는 시작 화면에서 해당 캐릭터 목록을 보고 선택한 후 게임에 입장한다.

---

## 2. 전체 아키텍처

### 레포 구조

```
web3DGame/
├── client/          기존 게임 (Three.js + Socket.IO)
│   └── src/ui/nameInput.ts  → 캐릭터 선택 화면으로 교체
├── server/          기존 서버 + 캐릭터 REST API + MongoDB 추가
└── admin/           새 Vite + TypeScript 앱 (Three.js 미리보기 포함)
```

### 데이터 흐름

```
[Admin 앱]
   ↓ REST API (POST / PUT / DELETE)
[server/] ←→ [MongoDB]
   ↓ REST API (GET)
[Game client] → 캐릭터 선택 화면 → 게임 입장
```

---

## 3. MongoDB 스키마

**Collection: `characters`**

```json
{
  "_id": "ObjectId",
  "name": "Daisy Pink",
  "description": "귀여운 핑크 데이지",
  "bodyColor": "#FFB7B2",
  "flowerColor": "#FFB7B2",
  "flowerType": "daisy",
  "visorColor": "#333333",
  "createdAt": "Date"
}
```

**색상 포맷:** MongoDB/API는 hex 문자열(`"#FFB7B2"`) 저장.
클라이언트에서 Three.js 숫자형으로 변환 필요:
```typescript
const toThreeColor = (hex: string): number => parseInt(hex.replace('#', '0x'));
// "#FFB7B2" → 0xFFB7B2
```
이 변환 함수는 `client/`와 `admin/` 양쪽에서 사용.

**flowerType 허용값:** `"daisy"` 만 허용 (현재 구현)
`createCharacterModel()`이 flowerType 파라미터를 받지 않으므로, API 유효성 검사도 `"daisy"`만 통과시킴.
`"tulip"`, `"sunflower"`는 모델 구현 후 허용값 확장.

---

## 4. REST API (server/)

| Method | Endpoint | 설명 | 사용처 |
|---|---|---|---|
| GET | `/api/characters` | 전체 캐릭터 목록 (전체 필드 포함) | 게임 클라이언트, Admin |
| GET | `/api/characters/:id` | 단일 캐릭터 조회 | Admin (편집 시) |
| POST | `/api/characters` | 캐릭터 생성 | Admin |
| PUT | `/api/characters/:id` | 캐릭터 수정 | Admin |
| DELETE | `/api/characters/:id` | 캐릭터 삭제 | Admin |

### 서버 측 유효성 검사 규칙

| 필드 | 타입 | 필수 | 조건 |
|---|---|---|---|
| `name` | string | ✅ | 1~20자 |
| `description` | string | ❌ | 최대 100자 |
| `bodyColor` | string | ✅ | `/^#[0-9A-Fa-f]{6}$/` |
| `flowerColor` | string | ✅ | `/^#[0-9A-Fa-f]{6}$/` |
| `visorColor` | string | ✅ | `/^#[0-9A-Fa-f]{6}$/` |
| `flowerType` | string | ✅ | `"daisy"` 만 허용 (tulip/sunflower는 모델 구현 후 추가) |

### 서버 파일 변경 사항

- `server/src/index.ts` — MongoDB 연결 추가, 라우터 등록
- `server/src/models/Character.ts` — Mongoose 스키마/모델
- `server/src/routes/characters.ts` — CRUD 라우터
- 기존 Socket.IO 로직은 변경 없음

---

## 5. Admin 앱 (`admin/`)

### 기술 스택

- Vite + TypeScript
- Three.js (캐릭터 3D 미리보기)
- 순수 CSS (별도 UI 라이브러리 없음)

### 화면 레이아웃 (단일 페이지, 좌우 분할)

```
┌─────────────────────────────────────────────────────┐
│  🌸 Character Admin                                  │
├──────────────────────┬──────────────────────────────┤
│  [캐릭터 목록]        │  [편집 / 생성 폼]             │
│                      │                              │
│  ● Daisy Pink    ✏️🗑 │  이름: [____________]        │
│  ● Sky Blue      ✏️🗑 │  설명: [____________]        │
│  ● Mint Green    ✏️🗑 │                              │
│                      │  바디 컬러: 🎨 [#FFB7B2]     │
│  [+ 새 캐릭터]        │  꽃 컬러:   🎨 [#FFB7B2]     │
│                      │  바이저 색: 🎨 [#333333]     │
│                      │  꽃 종류:   [daisy    ▼]     │
│                      │                              │
│                      │  ┌──────────────────────┐   │
│                      │  │   Three.js canvas    │   │
│                      │  │   (3D 미리보기)       │   │
│                      │  └──────────────────────┘   │
│                      │                              │
│                      │  [저장]  [취소]              │
└──────────────────────┴──────────────────────────────┘
```

### Admin 파일 구조

```
admin/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.ts              진입점, 앱 초기화
    ├── api.ts               서버 REST API 호출 함수
    ├── utils.ts             공통 유틸 (toThreeColor 등)
    ├── characterList.ts     좌측 목록 UI 렌더링
    ├── characterForm.ts     우측 폼 UI + 입력 처리
    └── preview3d.ts         Three.js 3D 미리보기 캔버스 (단일 인스턴스)
```

### 3D 미리보기 상세

- `characterModel.ts` 코드를 `admin/src/preview3d.ts` 내에 **복사**하여 사용.
  (공유 패키지 설정 복잡도를 피함. 향후 monorepo 전환 시 통합 가능.)
- 미리보기 캔버스는 **단일 Three.js 인스턴스** — 폼에서 값 변경 시 같은 캔버스에 실시간 반영
- 회전 조작: **마우스 드래그** + **방향키 (←→↑↓)**
- idle 상태에서 자동 천천히 Y축 회전

### visorColor 적용

`characterModel.ts`에 현재 `setVisorColor()` 메서드 없음.
구현 시 아래를 추가해야 함:
```typescript
(root as any).setVisorColor = (newColor: number) => {
  visor.material = new THREE.MeshStandardMaterial({
    color: newColor, roughness: 0.2, metalness: 0.1
  });
};
```
Admin 미리보기와 게임 클라이언트 양쪽에서 이 메서드를 사용.

### 인증

- 없음 (개발 단계)

---

## 6. 게임 클라이언트 변경 (`client/`)

### 캐릭터 선택 화면

기존 `nameInput.ts`를 교체. 새 파일: `client/src/ui/characterSelect.ts`

```
┌─────────────────────────────────────────────────────┐
│                  🌸 Web3D Game                      │
│                                                     │
│           이름: [________________]                  │
│                                                     │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐           │
│  │      │  │      │  │      │  │      │           │
│  │canvas│  │canvas│  │canvas│  │canvas│           │
│  │      │  │      │  │      │  │      │           │
│  │Daisy │  │ Sky  │  │ Mint │  │ Rose │           │
│  │ Pink │  │ Blue │  │Green │  │ Red  │           │
│  └──────┘  └──────┘  └──────┘  └──────┘           │
│      ↑ 선택됨 (하이라이트 테두리)                    │
│                                                     │
│                  [게임 시작]                         │
└─────────────────────────────────────────────────────┘
```

### Three.js 캔버스 전략 (WebGL 컨텍스트 제한 대응)

브라우저는 WebGL 컨텍스트를 8~16개로 제한함. 다수 카드에서 동시에 Three.js 인스턴스를 생성하면 초과 시 무음 실패 발생.

**전략: 단일 공유 캔버스 + CSS 스냅샷**
1. Three.js 인스턴스 하나만 생성
2. 각 캐릭터를 순서대로 렌더링 후 `canvas.toDataURL()`로 PNG 추출
3. 카드에는 `<img>` 태그로 스냅샷 표시
4. 선택된 카드 위에만 Three.js 캔버스를 오버레이하여 실시간 미리보기

### 빈 목록 폴백 (Empty State)

`GET /api/characters`가 빈 배열 반환 시:
- "등록된 캐릭터가 없습니다. 관리자에게 문의하세요." 메시지 표시
- [게임 시작] 버튼 비활성화
- 게임 진입 불가

### 서버 handshake 데이터 변경

```typescript
// 기존
{ playerName: "홍길동" }

// 변경 후
{
  playerName: "홍길동",
  characterId: "ObjectId 문자열",
  bodyColor: "#FFB7B2",    // hex 문자열
  flowerColor: "#FFB7B2",
  visorColor: "#333333",
  flowerType: "daisy"
}
```

**서버에서의 처리:**
- `characterId`로 DB 재검증은 하지 않음 (개발 단계: 클라이언트 값 신뢰)
- 기존의 랜덤 `bodyColor` 배정 로직 **제거**
- `players[socket.id]`에 클라이언트가 보낸 색상값을 hex 그대로 저장
- 다른 클라이언트에 브로드캐스트 시 hex 문자열로 전달 (`player_joined`, `current_players` 모두 동일)
- 수신 클라이언트에서 `toThreeColor(hex)` 변환 후 Three.js 적용

**handshake 폴백 기본값 (필드 누락/구버전 클라이언트 대응):**
```typescript
const auth = socket.handshake.auth as any;
players[socket.id] = {
  bodyColor:   auth.bodyColor   ?? "#FFB7B2",
  flowerColor: auth.flowerColor ?? "#FFB7B2",
  visorColor:  auth.visorColor  ?? "#333333",
  flowerType:  auth.flowerType  ?? "daisy",
  // ...
};
```
누락된 필드는 위 기본값으로 대체. 클라이언트를 차단하거나 리다이렉트하지 않음.

**`SET_NAME` 이벤트:** 캐릭터 선택 화면에서 이름을 handshake로 전달하므로 `SET_NAME` 이벤트는 **제거**. `nameInput.ts`가 `characterSelect.ts`로 교체되면서 자연히 사용되지 않음.

**색상 변환 위치:**
```typescript
// client/src/network/players.ts (원격 플레이어 렌더링 시)
const color = toThreeColor(playerData.bodyColor); // hex → number
model.setBodyColor(color);
model.setFlowerColor(toThreeColor(playerData.flowerColor));
model.setVisorColor(toThreeColor(playerData.visorColor));
```

---

## 7. 구현 순서

1. **`characterModel.ts` 확장** — `setVisorColor()` 메서드 추가
2. **MongoDB 연결** — `server/`에 mongoose 추가, Character 모델 + 유효성 검사 구현
3. **REST API** — `/api/characters` CRUD 라우터 구현
4. **Admin 앱** — `admin/` Vite 앱 생성, 목록/폼/3D 미리보기 구현
5. **게임 클라이언트** — `characterSelect.ts` 구현 (단일 캔버스 전략)
6. **서버 handshake 처리** — 랜덤 색상 제거, 클라이언트 데이터 적용, 브로드캐스트 수정
7. **클라이언트 색상 변환** — `toThreeColor` 유틸 추가, 원격 플레이어 렌더링 업데이트

---

## 8. 향후 확장 고려

- Admin 로그인 인증 추가
- 꽃 종류 확장 (tulip, sunflower 모델 구현)
- `characterId` 서버 측 검증 (DB 재조회로 색상 보장)
- 캐릭터 썸네일 이미지 서버 저장 (Three.js → Canvas → base64)
- 캐릭터별 플레이 통계 연동
