import { TermData, deleteTerm } from './termApi';

type OnSelect = (term: TermData) => void;
type OnNew = () => void;

export const renderTermList = (
  terms: TermData[],
  selectedId: number | null,
  onSelect: OnSelect,
  onNew: OnNew
) => {
  const listEl = document.getElementById('term-list')!;
  const addBtn = document.getElementById('term-add-btn')!;

  listEl.innerHTML = '';

  if (terms.length === 0) {
    listEl.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 text-on-surface-variant/40">
        <span class="material-symbols-outlined text-4xl mb-2">history_edu</span>
        <p class="text-sm font-medium">등록된 용어가 없습니다</p>
      </div>
    `;
  }

  terms.forEach((term) => {
    const isSelected = term.id === selectedId;
    const item = document.createElement('div');
    item.className = `group flex flex-shrink-0 w-48 items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
      isSelected 
        ? 'bg-tertiary-container/20 border-tertiary ring-1 ring-tertiary' 
        : 'bg-surface-container-low border-white/50 hover:border-tertiary/30 hover:shadow-md'
    }`;

    // Left side
    const info = document.createElement('div');
    info.className = 'flex items-center gap-3';

    const icon = document.createElement('div');
    icon.className = `w-8 h-8 rounded-md flex items-center justify-center ${isSelected ? 'bg-tertiary text-on-tertiary' : 'bg-tertiary-container/30 text-tertiary'}`;
    icon.innerHTML = '<span class="material-symbols-outlined text-base">history_edu</span>';

    const textGroup = document.createElement('div');
    const name = document.createElement('p');
    name.className = `font-headline font-bold text-xs ${isSelected ? 'text-tertiary' : 'text-on-surface'}`;
    name.textContent = term.term;

    const preview = document.createElement('p');
    preview.className = 'text-[9px] text-on-surface-variant line-clamp-1 max-w-[140px]';
    preview.textContent = term.description || '내용이 없습니다';

    textGroup.appendChild(name);
    textGroup.appendChild(preview);
    info.appendChild(icon);
    info.appendChild(textGroup);

    // Right side
    const actions = document.createElement('div');
    actions.className = 'flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity';

    const editBtn = document.createElement('button');
    editBtn.className = 'w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:bg-tertiary/10';
    editBtn.innerHTML = '<span class="material-symbols-outlined text-lg">edit</span>';
    editBtn.onclick = (e) => {
      e.stopPropagation();
      onSelect(term);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'w-8 h-8 rounded-full flex items-center justify-center text-error hover:bg-error/10';
    delBtn.innerHTML = '<span class="material-symbols-outlined text-lg">delete</span>';
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`"${term.term}" 용어를 삭제하시겠습니까?`)) return;
      try {
        await deleteTerm(term.id!);
        window.location.reload();
      } catch (err: any) {
        alert('Action failed: ' + err.message);
      }
    };

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    item.appendChild(info);
    item.appendChild(actions);
    
    item.addEventListener('click', () => onSelect(term));
    listEl.appendChild(item);
  });

  addBtn.onclick = onNew;
};
