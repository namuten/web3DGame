import { MapData, deleteMap } from './mapApi';

type OnSelect = (map: MapData) => void;
type OnNew = () => void;

let currentAudio: HTMLAudioElement | null = null;
let currentPlayingId: number | null = null;

export const stopBGM = () => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  currentPlayingId = null;
};

const updatePlayButtons = () => {
  document.querySelectorAll<HTMLButtonElement>('[data-bgm-id]').forEach(btn => {
    const id = Number(btn.dataset.bgmId);
    const isPlaying = id === currentPlayingId;
    btn.innerHTML = `<span class="material-symbols-outlined text-lg">${isPlaying ? 'stop_circle' : 'play_circle'}</span>`;
    btn.title = isPlaying ? 'Stop BGM' : 'Play BGM';
    btn.className = `w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
      isPlaying ? 'bg-secondary text-on-secondary shadow-md' : 'text-primary hover:bg-primary/10'
    }`;
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
    listEl.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 text-on-surface-variant/40">
        <span class="material-symbols-outlined text-4xl mb-2">map_off</span>
        <p class="text-sm font-medium">등록된 맵이 없습니다</p>
      </div>
    `;
  }

  maps.forEach((map) => {
    const isSelected = map.id === selectedId;
    const item = document.createElement('div');
    item.className = `group flex flex-shrink-0 w-52 items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
      isSelected 
        ? 'bg-primary-container/20 border-primary ring-1 ring-primary' 
        : 'bg-surface-container-low border-white/50 hover:border-primary/30 hover:shadow-md'
    }`;

    // Left side
    const info = document.createElement('div');
    info.className = 'flex items-center gap-3';

    const thumb = document.createElement('div');
    thumb.className = 'w-8 h-8 rounded-md shadow-inner flex-shrink-0 flex items-center justify-center relative overflow-hidden ring-1 ring-white/20';
    thumb.style.backgroundColor = map.bgColor || '#30628a';

    const textGroup = document.createElement('div');
    const nameWrap = document.createElement('div');
    nameWrap.className = 'flex items-center gap-2';

    const name = document.createElement('p');
    name.className = `font-headline font-bold text-xs ${isSelected ? 'text-primary' : 'text-on-surface'}`;
    name.textContent = map.name;

    const statusPill = document.createElement('span');
    statusPill.className = `px-1 py-0.5 rounded-full text-[7px] font-black uppercase tracking-tighter ${
      map.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
    }`;
    statusPill.textContent = map.isActive ? '활성' : '비활성';

    const themeLabel = document.createElement('p');
    themeLabel.className = 'text-[9px] uppercase tracking-widest text-tertiary font-bold';
    themeLabel.textContent = map.theme || 'Neutral';

    nameWrap.appendChild(name);
    nameWrap.appendChild(statusPill);
    textGroup.appendChild(nameWrap);
    textGroup.appendChild(themeLabel);
    info.appendChild(thumb);
    info.appendChild(textGroup);

    // Right side
    const actions = document.createElement('div');
    actions.className = 'flex gap-1 items-center';

    if (map.bgmFile) {
      const isPlaying = map.id === currentPlayingId;
      const bgmBtn = document.createElement('button');
      bgmBtn.dataset.bgmId = String(map.id);
      bgmBtn.className = `w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
        isPlaying ? 'bg-secondary text-on-secondary shadow-md' : 'text-primary hover:bg-primary/10'
      }`;
      bgmBtn.innerHTML = `<span class="material-symbols-outlined text-lg">${isPlaying ? 'stop_circle' : 'play_circle'}</span>`;
      bgmBtn.title = isPlaying ? 'Stop BGM' : 'Play BGM';
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
    editBtn.className = 'w-8 h-8 rounded-full flex items-center justify-center text-primary group-hover:opacity-100 opacity-0 transition-opacity hover:bg-primary/10';
    editBtn.innerHTML = '<span class="material-symbols-outlined text-lg">edit</span>';
    editBtn.title = 'Edit';
    editBtn.onclick = (e) => {
      e.stopPropagation();
      onSelect(map);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'w-8 h-8 rounded-full flex items-center justify-center text-error group-hover:opacity-100 opacity-0 transition-opacity hover:bg-error/10';
    delBtn.innerHTML = '<span class="material-symbols-outlined text-lg">delete</span>';
    delBtn.title = 'Deactivate';
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`"${map.name}" 맵을 삭제하시겠습니까?`)) return;
      await deleteMap(map.id!);
      window.location.reload();
    };

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    item.appendChild(info);
    item.appendChild(actions);
    
    item.addEventListener('click', () => onSelect(map));
    listEl.appendChild(item);
  });

  addBtn.onclick = onNew;
};
