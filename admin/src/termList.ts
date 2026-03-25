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
    listEl.innerHTML = '<div id="empty-state">용어가 없습니다</div>';
  }

  terms.forEach((term) => {
    const item = document.createElement('div');
    item.className = 'char-item' + (term.id === selectedId ? ' selected' : '');

    const name = document.createElement('span');
    name.className = 'char-item-name';
    name.textContent = term.term;

    const actions = document.createElement('div');
    actions.className = 'char-item-actions';

    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️';
    editBtn.title = '편집';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect(term);
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑';
    delBtn.title = '삭제';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`"${term.term}"을 삭제할까요?`)) return;
      try {
        await deleteTerm(term.id!);
        window.location.reload();
      } catch (err: any) {
        alert('삭제 실패: ' + err.message);
      }
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    item.appendChild(name);
    item.appendChild(actions);
    item.addEventListener('click', () => onSelect(term));
    listEl.appendChild(item);
  });

  addBtn.onclick = onNew;
};
