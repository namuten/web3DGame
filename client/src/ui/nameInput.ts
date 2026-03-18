export const showNameInput = (): Promise<string> => {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0;
      background: linear-gradient(135deg, #A2D2FF 0%, #BDE0FE 50%, #FFAFCC 100%);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      z-index: 9999; font-family: monospace;
    `;

    overlay.innerHTML = `
      <div style="
        background: rgba(255,255,255,0.85);
        border-radius: 20px;
        padding: 48px 56px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.15);
        text-align: center;
        min-width: 320px;
      ">
        <div style="font-size: 48px; margin-bottom: 8px;">🌸</div>
        <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #333;">Web3D Game</h1>
        <p style="margin: 0 0 28px 0; font-size: 13px; color: #888;">캐릭터 이름을 입력해주세요</p>
        <input id="name-input" type="text" maxlength="12" placeholder="이름 (최대 12자)"
          style="
            width: 100%; box-sizing: border-box;
            padding: 12px 16px; font-size: 16px; font-family: monospace;
            border: 2px solid #FFAFCC; border-radius: 10px; outline: none;
            text-align: center; color: #333;
            background: #fff;
          "
        />
        <button id="name-submit" style="
          margin-top: 16px; width: 100%;
          padding: 12px; font-size: 16px; font-family: monospace; font-weight: bold;
          background: linear-gradient(135deg, #FFAFCC, #A2D2FF);
          border: none; border-radius: 10px; cursor: pointer; color: #333;
          transition: opacity 0.2s;
        ">입장하기 🚀</button>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector('#name-input') as HTMLInputElement;
    const btn = overlay.querySelector('#name-submit') as HTMLButtonElement;
    input.focus();

    const submit = () => {
      const name = input.value.trim() || '익명';
      overlay.style.transition = 'opacity 0.4s';
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 400);
      resolve(name);
    };

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.stopPropagation();
        submit();
      }
    });
  });
};
