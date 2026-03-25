# Monster Terms — Design Spec
Date: 2026-03-25

## Overview
몬스터 몸 안에 표시되는 글자를 하드코딩에서 DB 기반으로 변경한다.
관리자 페이지에서 용어를 관리하고, 몬스터 스폰 시 서버가 랜덤으로 용어를 선택해 클라이언트에 전달한다.

---

## 1. DB 테이블

```sql
CREATE TABLE monster_terms (
  id          INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  term        VARCHAR(20)   NOT NULL,
  description VARCHAR(200)  NOT NULL,
  createdAt   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updatedAt   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

샘플 데이터 10개 이상 삽입 (과학/IT/게임 관련 한국어 용어).

---

## 2. 서버

### 2-1. `server/src/models/MonsterTerm.ts`
- `ensureTable()` — 테이블 없으면 자동 생성
- `findAll()` — 전체 목록
- `findRandom()` — 랜덤 1건 조회 (`ORDER BY RAND() LIMIT 1`), 결과 없으면 `null` 반환
- `create(data)`, `update(id, data)`, `remove(id)`

### 2-2. `server/src/routes/monsterTerms.ts`
REST API:
- `GET /api/monster-terms` — 전체 목록
- `POST /api/monster-terms` — 생성
- `PUT /api/monster-terms/:id` — 수정
- `DELETE /api/monster-terms/:id` — 삭제

**입력 유효성 검사 (POST / PUT):**
- `term`: 필수, 비어있지 않은 문자열, 최대 10자 (클라이언트 시각적 한계)
- `description`: 필수, 비어있지 않은 문자열, 최대 200자

### 2-3. `server/src/index.ts`
- `ensureMonsterTermTable()` 초기화 추가
- `monsterTermsRoute` 등록: `app.use('/api/monster-terms', monsterTermsRoutes)`
- 몬스터 스폰 시 `MonsterTerm.findRandom()` 호출
  - 결과가 `null`이면 `term`/`termDesc` 없이 스폰 (클라이언트 폴백 처리)
  - 결과가 있으면 monster 객체에 `term`, `termDesc` 포함

**monster 객체 구조 (변경 후):**
```ts
const monster = {
  id: 'boss_slime',
  mapId: mapIdStr,
  position: { x, y, z },
  targetId: null,
  speed: 0.45,
  alive: true,
  hp: 300,
  maxHp: 300,
  scale: 1.0,
  term: termRecord?.term ?? undefined,        // 추가
  termDesc: termRecord?.description ?? undefined  // 추가
};
```

`monsters[mapIdStr]`에 term/termDesc가 포함된 객체가 저장되므로,
후속 접속 플레이어에게도 동일한 용어가 전달된다 (기존 `socket.emit('MONSTER_SPAWN', monsters[mapIdStr])` 코드 그대로 동작).

---

## 3. 클라이언트

### 3-1. `client/src/game/monster.ts`

**`MonsterData` 인터페이스 (완전한 형태):**
```ts
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

**`createKoreanLetterMesh(char: string)`**
- 기존 랜덤 chars 배열 제거
- 파라미터로 받은 `char`를 canvas에 렌더링 (나머지 렌더링 코드 동일)

**`Monster` 클래스 생성자**
- `term`이 있으면 `[...term]`으로 글자 배열 분리 (Unicode 안전)
- `term`이 없거나 빈 문자열이면 기존 랜덤 한글자 배열에서 4개 폴백
- 슬롯 수 = `chars.length` (동적)
- 클라이언트 측 최대 표시 글자 수: 10자 초과 시 앞 10자만 사용

---

## 4. 어드민

### 파일 목록
| 파일 | 역할 |
|------|------|
| `admin/src/termApi.ts` | API 호출 함수 (VITE_API_URL 패턴 동일하게 사용) |
| `admin/src/termList.ts` | 좌측 용어 목록 렌더링 |
| `admin/src/termForm.ts` | 우측 편집 폼 (용어, 설명 입력/저장) |
| `admin/src/main.ts` | "용어" 탭 로직 추가 |
| `admin/index.html` | "용어" 탭 버튼 및 섹션 HTML 추가 |

### `admin/index.html` HTML ID 규칙 (중복 방지)
```html
<!-- 탭 버튼 -->
<button id="tab-terms" class="tab-btn">용어</button>

<!-- 섹션 -->
<div id="terms-section" style="display:none;">
  <div class="layout">
    <div id="term-list-panel">
      <button id="term-add-btn">+ 새 용어</button>
      <div id="term-list"></div>
    </div>
    <div id="term-form-panel">
      <div id="term-form-container">...</div>
    </div>
  </div>
</div>
```

### 폼 필드
- 용어 (text input, maxlength=10, 필수)
- 설명 (textarea, maxlength=200, 필수)
- 저장 / 취소 버튼

---

## 5. 데이터 흐름

```
관리자 → admin 페이지 → POST /api/monster-terms → DB 저장
                                                         ↓
플레이어 입장 → JOIN_MAP → 서버 스폰 타이머 → findRandom()
                                                  │
                                          null (테이블 비어있음)
                                                  │
                                    term 없이 MONSTER_SPAWN 전송
                                    클라이언트 폴백(랜덤 한글자)으로 표시
                                                  │
                                          용어 있음
                                                  │
                              MONSTER_SPAWN(term, termDesc) 전송
                              클라이언트 [...term] 분리 → 동적 슬롯 생성
                                                         ↓
                              monsters[mapId]에 term 포함 저장
                              → 후속 접속자도 동일 term 수신

몬스터 처치 → 재스폰 타이머 → 동일 로직으로 새 findRandom() 호출
```
