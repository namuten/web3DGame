export const initPartyUI = () => {
  const container = document.createElement('div');
  container.id = 'party-ui-container';
  container.style.cssText = `
    position: fixed;
    top: 60px;
    left: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 1000;
    pointer-events: none;
  `;
  document.body.appendChild(container);
};

export const addPartyMember = (id: string, name: string, hp: number, avatarUrl: string) => {
  const container = document.getElementById('party-ui-container');
  if (!container || document.getElementById(`party-member-${id}`)) return;

  const memberDiv = document.createElement('div');
  memberDiv.id = `party-member-${id}`;
  memberDiv.style.cssText = `
    display: flex;
    align-items: center;
    background: rgba(30, 30, 35, 0.75);
    padding: 6px;
    border-radius: 30px 10px 10px 30px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 2px 4px 10px rgba(0,0,0,0.5);
    width: 240px;
    position: relative;
    backdrop-filter: blur(4px);
  `;

  memberDiv.innerHTML = `
    <div style="
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 3px solid #edc531;
      background: #ccc url('${avatarUrl}') center/cover no-repeat;
      flex-shrink: 0;
      box-shadow: inset 0 0 8px rgba(0,0,0,0.6), 0 0 5px rgba(0,0,0,0.8);
      position: relative;
    ">
    </div>
    <div style="margin-left: 12px; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; padding-right: 8px;">
      <div style="
        font-family: 'Inter', sans-serif;
        font-size: 15px;
        font-weight: 700;
        color: #fce8a4;
        text-shadow: 1px 1px 3px #000;
        margin-bottom: 5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      ">${name}</div>
      <div style="
        width: 100%;
        height: 14px;
        background: #222;
        border: 1px solid #111;
        border-radius: 4px;
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.8);
        overflow: hidden;
        position: relative;
      ">
        <div id="party-hp-${id}" style="
          width: ${Math.max(0, Math.min(100, hp))}%;
          height: 100%;
          background: linear-gradient(to bottom, #7ceb88 0%, #4da655 100%);
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease;
          border-right: 1px solid rgba(255,255,255,0.4);
        "></div>
      </div>
    </div>
  `;

  // Sort local player to top if desired, or just append
  if (id === 'local') {
    container.insertBefore(memberDiv, container.firstChild);
  } else {
    container.appendChild(memberDiv);
  }
};

export const updatePartyMemberHP = (id: string, hp: number) => {
  const hpBar = document.getElementById(`party-hp-${id}`);
  if (hpBar) {
    const validHp = Math.max(0, Math.min(100, hp));
    hpBar.style.width = `${validHp}%`;
    if (validHp < 30) {
      hpBar.style.background = 'linear-gradient(to bottom, #ff6b6b 0%, #cc0000 100%)';
    } else if (validHp < 60) {
      hpBar.style.background = 'linear-gradient(to bottom, #ffea75 0%, #cca300 100%)';
    } else {
      hpBar.style.background = 'linear-gradient(to bottom, #7ceb88 0%, #4da655 100%)';
    }
  }
};

export const removePartyMember = (id: string) => {
  const memberDiv = document.getElementById(`party-member-${id}`);
  if (memberDiv) memberDiv.remove();
};

export const clearParty = () => {
  const container = document.getElementById('party-ui-container');
  if (container) container.innerHTML = '';
};
