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
