import { MonsterData, deleteMonster } from './monsterApi';

type OnSelect = (monster: MonsterData) => void;
type OnNew = () => void;

export const renderMonsterList = (
  monsters: MonsterData[],
  selectedId: number | null,
  onSelect: OnSelect,
  onNew: OnNew,
  onDelete: (id: number) => void
) => {

  const container = document.getElementById('monster-list-container')!;
  
  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-xl font-headline font-bold text-on-surface">몬스터 아카이브</h3>
      <button id="monster-add-btn" class="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-full hover:shadow-lg transition-all active:scale-95">
        <span class="material-symbols-outlined text-sm font-black">add</span>
        <span class="text-xs font-bold uppercase tracking-wider">신규 등록</span>
      </button>
    </div>
    <div id="monster-list" class="flex flex-nowrap overflow-x-auto gap-4 pb-4 px-1 scroll-smooth no-scrollbar"></div>
  `;

  const listEl = document.getElementById('monster-list')!;
  const addBtn = document.getElementById('monster-add-btn')!;

  if (monsters.length === 0) {
    listEl.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 text-on-surface-variant/40 w-full">
        <span class="material-symbols-outlined text-4xl mb-2">catching_pokemon</span>
        <p class="text-sm font-medium">등록된 몬스터가 없습니다</p>
      </div>
    `;
  }

  monsters.forEach((monster) => {
    const isSelected = monster.id === selectedId;
    const item = document.createElement('div');
    item.className = `group flex flex-shrink-0 w-52 items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
      isSelected 
        ? 'bg-primary-container/20 border-primary ring-1 ring-primary' 
        : 'bg-surface-container-low border-white/50 hover:border-primary/30 hover:shadow-md'
    }`;

    // Left side: Info
    const info = document.createElement('div');
    info.className = 'flex items-center gap-3';

    const icon = document.createElement('div');
    icon.className = 'w-8 h-8 rounded-md shadow-inner flex-shrink-0 flex items-center justify-center bg-tertiary-container/30 text-tertiary';
    icon.innerHTML = '<span class="material-symbols-outlined text-lg">smart_toy</span>';

    const textGroup = document.createElement('div');
    
    const nameWrap = document.createElement('div');
    nameWrap.className = 'flex items-center gap-2';

    const name = document.createElement('p');
    name.className = `font-headline font-bold text-xs ${isSelected ? 'text-primary' : 'text-on-surface'}`;
    name.textContent = monster.name;

    const statusPill = document.createElement('span');
    statusPill.className = `px-1 py-0.5 rounded-full text-[7px] font-black uppercase tracking-tighter ${
      monster.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
    }`;
    statusPill.textContent = monster.isActive ? '활성' : '비활성';

    const stats = document.createElement('p');
    stats.className = 'text-[9px] uppercase tracking-widest text-tertiary font-bold';
    stats.textContent = `HP ${monster.hp} | SPD ${monster.speed}`;

    nameWrap.appendChild(name);
    nameWrap.appendChild(statusPill);
    textGroup.appendChild(nameWrap);
    textGroup.appendChild(stats);
    info.appendChild(icon);
    info.appendChild(textGroup);

    // Right side: Actions
    const actions = document.createElement('div');
    actions.className = 'flex gap-1 items-center';

    const delBtn = document.createElement('button');
    delBtn.className = 'w-8 h-8 rounded-full flex items-center justify-center text-error group-hover:opacity-100 opacity-0 transition-opacity hover:bg-error/10';
    delBtn.innerHTML = '<span class="material-symbols-outlined text-lg">delete</span>';
    delBtn.title = 'Deactivate';
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`"${monster.name}"을 영구 삭제하시겠습니까? (DB에서 제거됩니다)`)) return;
      onDelete(monster.id!);
    };


    actions.appendChild(delBtn);

    item.appendChild(info);
    item.appendChild(actions);
    
    item.addEventListener('click', () => onSelect(monster));
    listEl.appendChild(item);
  });

  addBtn.onclick = onNew;
};
