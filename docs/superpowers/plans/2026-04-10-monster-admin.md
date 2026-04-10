# Monster Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 어드민 페이지에 몬스터 관리 탭을 추가한다. GLB 파일·효과음 업로드, 체력·이동속도·크기 설정을 DB로 관리하며, 나중에 맵과 연결한다.

**Architecture:** 캐릭터/맵과 동일한 패턴(Model → Route → Admin UI). 파일 업로드는 multer 사용. 기존 monster.ts의 GLTFLoader는 유지하고 설정값만 서버에서 받는다.

**Tech Stack:** Node.js/Express, MySQL(mysql2/promise), multer, TypeScript, Vite, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-10-monster-admin-design.md`

---

## 파일 구조 요약

| 파일 | 상태 | 역할 |
|------|------|------|
| `server/src/models/Monster.ts` | 신규 | Monster DB 모델 + ensureTable |
| `server/src/routes/monsters.ts` | 신규 | REST CRUD API + multer 업로드 |
| `server/src/index.ts` | 수정 | 몬스터 라우트 등록 + static 서빙 |
| `admin/src/monsterApi.ts` | 신규 | 어드민 몬스터 REST 클라이언트 |
| `admin/src/monsterList.ts` | 신규 | 몬스터 목록 UI |
| `admin/src/monsterForm.ts` | 신규 | 몬스터 생성/수정 폼 UI |
| `admin/src/main.ts` | 수정 | 몬스터 관리 탭 추가 |
| `admin/index.html` | 수정 | 탭 버튼·섹션 추가 |

---

## Task 1: multer 패키지 설치

**Files:**
- Run: `server/` 디렉터리에서 `npm install multer @types/multer`

- [ ] `server/` 에서 multer, @types/multer 설치
- [ ] 설치 후 `server/package.json` 확인

---

## Task 2: Monster DB 모델 생성

**Files:**
- Create: `server/src/models/Monster.ts`

참고 파일: `server/src/models/Map.ts` (동일 패턴)

- [ ] `MonsterRow` 내부 타입 + `GameMonster` 인터페이스 정의
- [ ] `ensureTable()` — monsters 테이블 자동 생성
- [ ] `rowToMonster()` — snake_case → camelCase 변환
- [ ] `findAll()` — 전체 목록
- [ ] `findAllActive()` — 활성 목록 (게임용)
- [ ] `findById(id)` — 단건 조회
- [ ] `create(data)` — 생성
- [ ] `update(id, data)` — 수정
- [ ] `deactivate(id)` — soft delete (is_active = false)

---

## Task 3: Monster REST API 라우터 생성

**Files:**
- Create: `server/src/routes/monsters.ts`

참고 파일: `server/src/routes/maps.ts` (동일 패턴)

- [ ] `GET /` — 활성 몬스터 목록 (게임용)
- [ ] `GET /all` — 전체 목록 (어드민용)
- [ ] `GET /:id` — 단건 조회
- [ ] `POST /upload` — multer로 파일 업로드 처리
  - 저장 경로: `server/public/uploads/monsters/`
  - 파일명: `Date.now() + '-' + originalname`
  - 응답: `{ filename: "..." }`
- [ ] `POST /` — 몬스터 생성 (JSON body)
- [ ] `PUT /:id` — 몬스터 수정
- [ ] `DELETE /:id` — soft delete

---

## Task 4: server/src/index.ts 수정

**Files:**
- Modify: `server/src/index.ts`

- [ ] `path` import 추가
- [ ] Monster 모델 import + ensureTable 호출
- [ ] Monster 라우터 import + `app.use('/api/monsters', monsterRoutes)` 등록
- [ ] static 서빙 추가: `app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')))`
- [ ] `server/public/uploads/monsters/` 디렉터리 생성 (없으면)

---

## Task 5: 어드민 monsterApi.ts 생성

**Files:**
- Create: `admin/src/monsterApi.ts`

참고 파일: `admin/src/mapApi.ts` (동일 패턴)

- [ ] `MonsterData` 인터페이스 정의
- [ ] `fetchMonsters()` — 전체 목록
- [ ] `fetchMonster(id)` — 단건
- [ ] `uploadMonsterFile(file)` — 파일 업로드 → filename 반환
- [ ] `createMonster(data)` — 생성
- [ ] `updateMonster(id, data)` — 수정
- [ ] `deleteMonster(id)` — 삭제

---

## Task 6: 어드민 monsterList.ts 생성

**Files:**
- Create: `admin/src/monsterList.ts`

참고 파일: `admin/src/mapList.ts` (동일 패턴)

- [ ] `renderMonsterList(monsters, selectedId, onSelect, onNew)` 함수
- [ ] 몬스터 이름 + 체력/속도 표시
- [ ] 신규 등록 버튼
- [ ] 선택된 항목 하이라이트

---

## Task 7: 어드민 monsterForm.ts 생성

**Files:**
- Create: `admin/src/monsterForm.ts`

참고 파일: `admin/src/mapForm.ts` (Tailwind 스타일 동일하게)

- [ ] `renderMonsterForm(monster, onSaved)` 함수
- [ ] 이름 입력 (text)
- [ ] GLB 파일 업로드 버튼 + 현재 파일명 표시
- [ ] 체력 입력 (number, 1~10000)
- [ ] 이동속도 슬라이더 (range, 0.5~10.0, 소수점 1자리 표시)
- [ ] 크기 슬라이더 (range, 0.1~5.0, 소수점 1자리 표시, 기본 1.0)
- [ ] 이동 효과음 업로드 버튼 + 현재 파일명 표시
- [ ] 공격/울음 효과음 업로드 버튼 + 현재 파일명 표시
- [ ] 활성화 토글
- [ ] 저장/취소 버튼
- [ ] 파일 업로드는 버튼 클릭 시 즉시 `/api/monsters/upload` 전송 후 filename 저장

---

## Task 8: admin/src/main.ts 수정

**Files:**
- Modify: `admin/src/main.ts`

- [ ] `monsterApi.ts`, `monsterList.ts`, `monsterForm.ts` import
- [ ] `showTab` 타입에 `'monsters'` 추가
- [ ] `monsters-section` show/hide 로직 추가
- [ ] `loadMonsters`, `onSelectMonster`, `onNewMonster` 함수 추가
- [ ] `tab-monsters` 클릭 이벤트 등록
- [ ] URL hash `#monsters` 지원

---

## Task 9: admin/index.html 수정

**Files:**
- Modify: `admin/index.html`

- [ ] 탭 버튼 `tab-monsters` 추가 (기존 탭들 옆에)
- [ ] `monsters-section` div 추가
  - `monster-list-container`
  - `monster-form-container`

---

## 주의사항

- server import 경로: `.js` 확장자 필수 (ex: `'../models/Monster.js'`)
- multer `diskStorage` 사용 (memoryStorage 아님 — 파일 크기 클 수 있음)
- GLB 파일은 수 MB 이상일 수 있으므로 multer `limits.fileSize` = 50MB 설정
- 맵-몬스터 연결은 이번 작업에서 구현하지 않음 (별도 태스크)
