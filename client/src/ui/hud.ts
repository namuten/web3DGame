export const initHUD = () => {
    const hudContainer = document.createElement('div');
    hudContainer.style.position = 'absolute';
    hudContainer.style.bottom = '20px';
    hudContainer.style.left = '20px';
    hudContainer.style.color = '#00f0ff';
    hudContainer.style.fontFamily = 'monospace';
    hudContainer.style.fontSize = '14px';
    hudContainer.style.background = 'rgba(255, 255, 255, 0.7)';
    hudContainer.style.padding = '15px';
    hudContainer.style.borderRadius = '8px';
    hudContainer.style.border = '1px solid #cccccc';
    hudContainer.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.1)';
    hudContainer.style.pointerEvents = 'none'; // 클릭 방해 방지
    hudContainer.innerHTML = `
        <h3 style="margin: 0 0 10px 0; color: #333;">MULTIPLAYER SECURE LINK</h3>
        <p style="margin: 0; color: #555">• STATUS: <span style="color:#2ecc71">ONLINE</span></p>
        <p style="margin: 5px 0 0 0; color: #555">• CONTROLS: W, A, S, D</p>
    `;
    document.body.appendChild(hudContainer);

    const crosshair = document.createElement('div');
    crosshair.style.position = 'absolute';
    crosshair.style.top = '50%';
    crosshair.style.left = '50%';
    crosshair.style.transform = 'translate(-50%, -50%)';
    crosshair.style.color = 'rgba(255, 255, 255, 0.5)';
    crosshair.style.fontSize = '24px';
    crosshair.style.pointerEvents = 'none';
    crosshair.innerHTML = '+';
    document.body.appendChild(crosshair);
};
