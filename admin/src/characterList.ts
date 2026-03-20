import { CharacterData, deleteCharacter } from './api';

type OnSelect = (char: CharacterData) => void;
type OnNew = () => void;

export const renderList = (
  characters: CharacterData[],
  selectedId: string | null,
  onSelect: OnSelect,
  onNew: OnNew
) => {
  const listEl = document.getElementById('character-list')!;
  const addBtn = document.getElementById('add-btn')!;

  listEl.innerHTML = '';

  if (characters.length === 0) {
    listEl.innerHTML = '<div id="empty-state">캐릭터가 없습니다</div>';
  }

  characters.forEach((char) => {
    const item = document.createElement('div');
    item.className = 'char-item' + (char._id === selectedId ? ' selected' : '');

    const dot = document.createElement('span');
    dot.style.cssText = `display:inline-block;width:12px;height:12px;border-radius:50%;background:${char.bodyColor};margin-right:8px;flex-shrink:0;`;

    const name = document.createElement('span');
    name.className = 'char-item-name';
    name.textContent = char.name;

    const nameWrapper = document.createElement('div');
    nameWrapper.style.display = 'flex';
    nameWrapper.style.alignItems = 'center';
    nameWrapper.appendChild(dot);
    nameWrapper.appendChild(name);

    const actions = document.createElement('div');
    actions.className = 'char-item-actions';

    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️';
    editBtn.title = '편집';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect(char);
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑';
    delBtn.title = '삭제';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`"${char.name}"을 삭제할까요?`)) return;
      await deleteCharacter(char._id!);
      window.location.reload();
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    item.appendChild(nameWrapper);
    item.appendChild(actions);
    item.addEventListener('click', () => onSelect(char));
    listEl.appendChild(item);
  });

  addBtn.onclick = onNew;
};
