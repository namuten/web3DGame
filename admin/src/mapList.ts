import { MapData, deleteMap } from './mapApi';

type OnSelect = (map: MapData) => void;
type OnNew = () => void;

let currentAudio: HTMLAudioElement | null = null;
let currentPlayingId: number | null = null;

const stopBGM = () => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  currentPlayingId = null;
};

const updatePlayButtons = () => {
  document.querySelectorAll<HTMLButtonElement>('[data-bgm-id]').forEach(btn => {
    const id = Number(btn.dataset.bgmId);
    btn.textContent = id === currentPlayingId ? '⏹' : '🎵';
    btn.title = id === currentPlayingId ? 'BGM 중지' : 'BGM 재생';
  });
};

export const renderMapList = (
  maps: MapData[],
  selectedId: number | null,
  onSelect: OnSelect,
  onNew: OnNew
) => {
  const listEl = document.getElementById('map-list')!;
  const addBtn = document.getElementById('map-add-btn')!;

  listEl.innerHTML = '';

  if (maps.length === 0) {
    listEl.innerHTML = '<div id="empty-state">맵이 없습니다</div>';
  }

  maps.forEach((map) => {
    const item = document.createElement('div');
    item.className = 'char-item' + (map.id === selectedId ? ' selected' : '');

    const dot = document.createElement('span');
    dot.style.cssText = `display:inline-block;width:12px;height:12px;border-radius:50%;background:${map.bgColor};margin-right:8px;flex-shrink:0;border:1px solid #ccc;`;

    const name = document.createElement('span');
    name.className = 'char-item-name';
    name.textContent = `${map.name} (${map.theme})`;

    const activeTag = document.createElement('span');
    activeTag.textContent = map.isActive ? '●' : '○';
    activeTag.style.cssText = `margin-left:6px;color:${map.isActive ? '#4caf50' : '#aaa'};font-size:11px;`;

    const nameWrapper = document.createElement('div');
    nameWrapper.style.display = 'flex';
    nameWrapper.style.alignItems = 'center';
    nameWrapper.appendChild(dot);
    nameWrapper.appendChild(name);
    nameWrapper.appendChild(activeTag);

    const actions = document.createElement('div');
    actions.className = 'char-item-actions';

    // BGM 재생 버튼
    if (map.bgmFile) {
      const bgmBtn = document.createElement('button');
      bgmBtn.dataset.bgmId = String(map.id);
      bgmBtn.textContent = map.id === currentPlayingId ? '⏹' : '🎵';
      bgmBtn.title = map.id === currentPlayingId ? 'BGM 중지' : 'BGM 재생';
      bgmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentPlayingId === map.id) {
          stopBGM();
        } else {
          stopBGM();
          const audio = new Audio(`/sounds/bgm/${map.bgmFile}.mp3`);
          audio.loop = true;
          audio.volume = 0.5;
          audio.play().catch(() => {});
          audio.addEventListener('ended', () => { currentPlayingId = null; updatePlayButtons(); });
          currentAudio = audio;
          currentPlayingId = map.id!;
        }
        updatePlayButtons();
      });
      actions.appendChild(bgmBtn);
    }

    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️';
    editBtn.title = '편집';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect(map);
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑';
    delBtn.title = '비활성화';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`"${map.name}"을 비활성화할까요?`)) return;
      await deleteMap(map.id!);
      window.location.reload();
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    item.appendChild(nameWrapper);
    item.appendChild(actions);
    item.addEventListener('click', () => onSelect(map));
    listEl.appendChild(item);
  });

  addBtn.onclick = onNew;
};
