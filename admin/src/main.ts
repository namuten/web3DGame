import { fetchCharacters, CharacterData } from './api';
import { renderList } from './characterList';
import { renderForm } from './characterForm';
import { fetchMaps, MapData } from './mapApi';
import { renderMapList } from './mapList';
import { renderMapForm } from './mapForm';
import { fetchTerms, TermData } from './termApi';
import { renderTermList } from './termList';
import { renderTermForm } from './termForm';
import { fetchMonsters, MonsterData, deleteMonster } from './monsterApi';

import { renderMonsterList } from './monsterList';
import { renderMonsterForm } from './monsterForm';


// ─── 탭 전환 ────────────────────────────────────────
const showTab = (tab: 'characters' | 'maps' | 'terms' | 'monsters') => {

  const charSection  = document.getElementById('characters-section')!;
  const mapSection     = document.getElementById('maps-section')!;
  const termsSection   = document.getElementById('terms-section')!;
  const monsterSection = document.getElementById('monsters-section')!;
  const charTab        = document.getElementById('tab-characters')!;
  const mapTab         = document.getElementById('tab-maps')!;
  const termsTab       = document.getElementById('tab-terms')!;
  const monsterTab     = document.getElementById('tab-monsters')!;

  charSection.style.display    = tab === 'characters' ? '' : 'none';
  mapSection.style.display     = tab === 'maps'       ? '' : 'none';
  termsSection.style.display   = tab === 'terms'      ? '' : 'none';
  monsterSection.style.display = tab === 'monsters'   ? '' : 'none';

  charTab.classList.toggle('active',    tab === 'characters');
  mapTab.classList.toggle('active',     tab === 'maps');
  termsTab.classList.toggle('active',    tab === 'terms');
  monsterTab.classList.toggle('active',  tab === 'monsters');

  const pageTitle = document.getElementById('page-title')!;
  if (tab === 'characters') pageTitle.textContent = '캐릭터 관리';
  else if (tab === 'maps') pageTitle.textContent = '맵 관리';
  else if (tab === 'terms') pageTitle.textContent = '용어 관리';
  else pageTitle.textContent = '몬스터 관리';

  if (tab === 'characters') loadCharacters();
  else if (tab === 'maps')  loadMaps();
  else if (tab === 'terms') loadTerms();
  else                      loadMonsters();
};


// ─── 캐릭터 ────────────────────────────────────────
let characters: CharacterData[] = [];
let selectedCharId: string | null = null;

const loadCharacters = async () => {
  characters = await fetchCharacters();
  renderList(characters, selectedCharId, onSelectChar, onNewChar);
  
  if (!selectedCharId && characters.length > 0) {
    onSelectChar(characters[0]);
  }
};

const onSelectChar = (char: CharacterData) => {
  selectedCharId = char._id ?? null;
  renderList(characters, selectedCharId, onSelectChar, onNewChar);
  renderForm(char, async (savedChar?: CharacterData) => { 
    await loadCharacters(); 
    if (savedChar) onSelectChar(savedChar);
  });
};

const onNewChar = () => {
  selectedCharId = null;
  renderList(characters, selectedCharId, onSelectChar, onNewChar);
  renderForm(null, async (savedChar?: CharacterData) => { 
    await loadCharacters(); 
    if (savedChar) onSelectChar(savedChar);
  });
};

// ─── 맵 ────────────────────────────────────────────
let maps: MapData[] = [];
let selectedMapId: number | null = null;

const loadMaps = async () => {
  maps = await fetchMaps();
  renderMapList(maps, selectedMapId, onSelectMap, onNewMap);

  if (!selectedMapId && maps.length > 0) {
    onSelectMap(maps[0]);
  }
};

const onSelectMap = async (map: MapData) => {
  selectedMapId = map.id ?? null;
  renderMapList(maps, selectedMapId, onSelectMap, onNewMap);
  await renderMapForm(map, async (savedMap?: MapData) => { 
    await loadMaps(); 
    if (savedMap) onSelectMap(savedMap);
  });
};

const onNewMap = async () => {
  selectedMapId = null;
  renderMapList(maps, selectedMapId, onSelectMap, onNewMap);
  await renderMapForm(null, async (savedMap?: MapData) => { 
    await loadMaps(); 
    if (savedMap) onSelectMap(savedMap);
  });
};

// ─── 용어 ────────────────────────────────────────────
let terms: TermData[] = [];
let selectedTermId: number | null = null;

const loadTerms = async () => {
  terms = await fetchTerms();
  renderTermList(terms, selectedTermId, onSelectTerm, onNewTerm);

  if (!selectedTermId && terms.length > 0) {
    onSelectTerm(terms[0]);
  }
};

const onSelectTerm = (term: TermData) => {
  selectedTermId = term.id ?? null;
  renderTermList(terms, selectedTermId, onSelectTerm, onNewTerm);
  renderTermForm(term, async (savedTerm?: TermData) => { 
    await loadTerms(); 
    if (savedTerm) onSelectTerm(savedTerm);
  });
};

const onNewTerm = () => {
  selectedTermId = null;
  renderTermList(terms, selectedTermId, onSelectTerm, onNewTerm);
  renderTermForm(null, async (savedTerm?: TermData) => { 
    await loadTerms(); 
    if (savedTerm) onSelectTerm(savedTerm);
  });
};

// ─── 몬스터 ──────────────────────────────────────────
let monsters: MonsterData[] = [];
let selectedMonsterId: number | null = null;

const loadMonsters = async () => {
  monsters = await fetchMonsters();
  renderMonsterList(monsters, selectedMonsterId, onSelectMonster, onNewMonster, async (id) => {
    try {
      await deleteMonster(id);
      if (selectedMonsterId === id) selectedMonsterId = null;
      await loadMonsters();
    } catch (e: any) {
      console.error('[Admin] Delete failed:', e);
      alert('삭제 실패: ' + e.message);
    }
  });

  if (!selectedMonsterId && monsters.length > 0) {
    onSelectMonster(monsters[0]);
  }
};

const onSelectMonster = (monster: MonsterData) => {
  selectedMonsterId = monster.id ?? null;
  loadMonsters(); // renderMonsterList is called inside loadMonsters
  renderMonsterForm(monster, async (saved?: MonsterData) => {
    await loadMonsters();
    if (saved) onSelectMonster(saved);
  });
};

const onNewMonster = () => {
  selectedMonsterId = null;
  loadMonsters();
  renderMonsterForm(null, async (saved?: MonsterData) => {
    await loadMonsters();
    if (saved) onSelectMonster(saved);
  });
};



// ─── 초기화 ─────────────────────────────────────────
document.getElementById('tab-characters')!.addEventListener('click', () => showTab('characters'));
document.getElementById('tab-maps')!.addEventListener('click',       () => showTab('maps'));
document.getElementById('tab-terms')!.addEventListener('click',      () => showTab('terms'));
document.getElementById('tab-monsters')!.addEventListener('click',   () => showTab('monsters'));

const hash = window.location.hash;
showTab(hash === '#maps' ? 'maps' : hash === '#terms' ? 'terms' : hash === '#monsters' ? 'monsters' : 'characters');

