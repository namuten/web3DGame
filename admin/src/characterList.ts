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
    listEl.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 text-on-surface-variant/40">
        <span class="material-symbols-outlined text-4xl mb-2">person_off</span>
        <p class="text-sm font-medium">등록된 캐릭터가 없습니다</p>
      </div>
    `;
  }

  characters.forEach((char) => {
    const isSelected = char._id === selectedId;
    const item = document.createElement('div');
    item.className = `group flex flex-shrink-0 w-48 items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
      isSelected 
        ? 'bg-primary-container/20 border-primary ring-1 ring-primary' 
        : 'bg-surface-container-low border-white/50 hover:border-primary/30 hover:shadow-md'
    }`;

    // Left side: Icon + Info
    const info = document.createElement('div');
    info.className = 'flex items-center gap-3';

    const avatar = document.createElement('div');
    avatar.className = 'w-8 h-8 rounded-md shadow-inner flex-shrink-0 flex items-center justify-center relative overflow-hidden';
    avatar.style.backgroundColor = char.bodyColor || '#30628a';
    
    // Subtle glow based on color
    const glow = document.createElement('div');
    glow.className = 'absolute inset-0 opacity-30';
    glow.style.background = `radial-gradient(circle at center, white, transparent)`;
    avatar.appendChild(glow);

    const textGroup = document.createElement('div');
    const name = document.createElement('p');
    name.className = `font-headline font-bold text-xs ${isSelected ? 'text-primary' : 'text-on-surface'}`;
    name.textContent = char.name;

    const typeLabel = document.createElement('p');
    typeLabel.className = 'text-[9px] uppercase tracking-widest text-tertiary font-bold';
    typeLabel.textContent = char.flowerType || 'Normal';

    textGroup.appendChild(name);
    textGroup.appendChild(typeLabel);
    info.appendChild(avatar);
    info.appendChild(textGroup);

    // Right side: Actions
    const actions = document.createElement('div');
    actions.className = 'flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity';

    const editBtn = document.createElement('button');
    editBtn.className = 'w-8 h-8 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 transition-colors';
    editBtn.innerHTML = '<span class="material-symbols-outlined text-lg">edit</span>';
    editBtn.title = 'Edit';
    editBtn.onclick = (e) => {
      e.stopPropagation();
      onSelect(char);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'w-8 h-8 rounded-full flex items-center justify-center text-error hover:bg-error/10 transition-colors';
    delBtn.innerHTML = '<span class="material-symbols-outlined text-lg">delete</span>';
    delBtn.title = 'Delete';
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`"${char.name}" 캐릭터를 삭제하시겠습니까?`)) return;
      await deleteCharacter(char._id!);
      window.location.reload();
    };

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    item.appendChild(info);
    item.appendChild(actions);
    
    item.addEventListener('click', () => onSelect(char));
    listEl.appendChild(item);
  });

  addBtn.onclick = onNew;
};
