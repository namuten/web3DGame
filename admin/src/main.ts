import { fetchCharacters, CharacterData } from './api';
import { renderList } from './characterList';
import { renderForm } from './characterForm';
import { fetchMaps, MapData } from './mapApi';
import { renderMapList } from './mapList';
import { renderMapForm } from './mapForm';

// ─── 탭 전환 ────────────────────────────────────────
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
  renderMapForm(map, async () => { await loadMaps(); });
};

const onNewMap = () => {
  selectedMapId = null;
  renderMapList(maps, selectedMapId, onSelectMap, onNewMap);
  renderMapForm(null, async () => { await loadMaps(); });
};

// ─── 초기화 ─────────────────────────────────────────
document.getElementById('tab-characters')!.addEventListener('click', () => showTab('characters'));
document.getElementById('tab-maps')!.addEventListener('click',       () => showTab('maps'));

const hash = window.location.hash;
showTab(hash === '#maps' ? 'maps' : 'characters');
