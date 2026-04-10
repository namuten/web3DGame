import { fetchCharacters, CharacterData } from './api';
import { renderList } from './characterList';
import { renderForm } from './characterForm';
import { fetchMaps, MapData } from './mapApi';
import { renderMapList } from './mapList';
import { renderMapForm } from './mapForm';
import { fetchTerms, TermData } from './termApi';
import { renderTermList } from './termList';
import { renderTermForm } from './termForm';

// ─── 탭 전환 ────────────────────────────────────────
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

  const pageTitle = document.getElementById('page-title')!;
  if (tab === 'characters') pageTitle.textContent = '캐릭터 관리';
  else if (tab === 'maps') pageTitle.textContent = '맵 관리';
  else pageTitle.textContent = '용어 관리';

  if (tab === 'characters') loadCharacters();
  else if (tab === 'maps')  loadMaps();
  else                      loadTerms();
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
  renderMapForm(map, async (savedMap?: MapData) => { 
    await loadMaps(); 
    if (savedMap) onSelectMap(savedMap);
  });
};

const onNewMap = () => {
  selectedMapId = null;
  renderMapList(maps, selectedMapId, onSelectMap, onNewMap);
  renderMapForm(null, async (savedMap?: MapData) => { 
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

// ─── 초기화 ─────────────────────────────────────────
document.getElementById('tab-characters')!.addEventListener('click', () => showTab('characters'));
document.getElementById('tab-maps')!.addEventListener('click',       () => showTab('maps'));
document.getElementById('tab-terms')!.addEventListener('click',      () => showTab('terms'));

const hash = window.location.hash;
showTab(hash === '#maps' ? 'maps' : hash === '#terms' ? 'terms' : 'characters');
