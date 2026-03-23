// MapConfig is not used here, using MapInfo instead

const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

interface MapInfo {
  id: number;
  name: string;
  bgColor: string;
}

export const showLobby = (): Promise<number> => {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = 'lobby-overlay';
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.85);
      display:flex; align-items:center; justify-content:center;
      z-index:9999; font-family:sans-serif; color:#eee;
    `;

    overlay.innerHTML = `
      <div style="background:#1a1a2e;border-radius:12px;padding:32px;min-width:320px;max-width:480px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
        <h2 style="text-align:center;margin:0 0 24px;font-size:20px;letter-spacing:2px;">🗺 맵 선택</h2>
        <div id="lobby-map-list" style="margin-bottom:24px;">
          <div style="text-align:center;color:#888;">맵 목록 불러오는 중...</div>
        </div>
        <button id="lobby-enter-btn" style="
          width:100%;padding:12px;background:#4caf50;border:none;border-radius:8px;
          color:#fff;font-size:16px;cursor:pointer;font-weight:bold;
        " disabled>입장하기</button>
      </div>
    `;

    document.body.appendChild(overlay);

    let selectedMapId: number | null = null;

    const renderMaps = (maps: MapInfo[], playerCounts: Record<string, number>) => {
      const listEl = document.getElementById('lobby-map-list')!;
      if (!listEl) return;
      if (maps.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;color:#888;">등록된 맵이 없습니다.</div>';
        return;
      }
      listEl.innerHTML = '';
      maps.forEach((map) => {
        const item = document.createElement('div');
        const count = playerCounts[String(map.id)] || 0;
        const isSelected = map.id === selectedMapId;
        item.style.cssText = `
          display:flex;justify-content:space-between;align-items:center;
          padding:12px 16px;margin-bottom:8px;border-radius:8px;cursor:pointer;
          border:2px solid ${isSelected ? '#4caf50' : '#333'};
          background:${isSelected ? '#1e3a1e' : '#2a2a3e'};
          transition:border-color 0.2s;
        `;
        const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${map.bgColor};margin-right:8px;border:1px solid #555;"></span>`;
        item.innerHTML = `
          <span>${dot}${map.name}</span>
          <span style="color:#aaa;font-size:13px;">👥 ${count}명</span>
        `;
        item.addEventListener('click', () => {
          selectedMapId = map.id;
          renderMaps(maps, playerCounts);
          const enterBtn = document.getElementById('lobby-enter-btn') as HTMLButtonElement;
          if (enterBtn) enterBtn.disabled = false;
        });
        listEl.appendChild(item);
      });
    };

    // 맵 목록 불러오기
    let mapList: MapInfo[] = [];
    let currentCounts: Record<string, number> = {};

    fetch(`${API_URL}/api/maps`)
      .then(r => r.json())
      .then((maps: MapInfo[]) => {
        mapList = maps;
        renderMaps(mapList, currentCounts);
      })
      .catch((err) => {
        console.error('Fetch maps error:', err);
        const listEl = document.getElementById('lobby-map-list');
        if (listEl) listEl.innerHTML = '<div style="text-align:center;color:#f44;">맵 목록을 불러오지 못했습니다.</div>';
      });

    // MAP_PLAYERS 이벤트로 실시간 갱신 (socket.ts 에서 등록)
    // main.ts에서 onMapPlayers를 연결함
    (window as any).__updateLobbyMapPlayers = (counts: Record<string, number>) => {
      currentCounts = counts;
      renderMaps(mapList, currentCounts);
    };

    document.getElementById('lobby-enter-btn')!.addEventListener('click', () => {
      if (selectedMapId === null) return;
      document.body.removeChild(overlay);
      delete (window as any).__updateLobbyMapPlayers;
      resolve(selectedMapId);
    });
  });
};
