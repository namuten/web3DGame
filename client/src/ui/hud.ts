export const initHUD = () => {
    const hudContainer = document.createElement('div');
    hudContainer.style.position = 'absolute';
    hudContainer.style.bottom = '20px';
    hudContainer.style.left = '20px';
    hudContainer.style.color = '#E0E0FF';
    hudContainer.style.fontFamily = 'monospace';
    hudContainer.style.fontSize = '14px';
    hudContainer.style.background = 'rgba(20, 20, 30, 0.4)';
    hudContainer.style.backdropFilter = 'blur(8px)';
    (hudContainer.style as any)['-webkit-backdrop-filter'] = 'blur(8px)';
    hudContainer.style.padding = '15px';
    hudContainer.style.borderRadius = '0 12px 12px 0';
    hudContainer.style.borderLeft = '4px solid #FF7EDB';
    hudContainer.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.2)';
    hudContainer.style.pointerEvents = 'none'; // 클릭 방해 방지
    hudContainer.innerHTML = `
        <h3 style="margin: 0 0 10px 0; color: #E0E0FF;">MULTIPLAYER SECURE LINK</h3>
        <p style="margin: 0; color: #E0E0FF">• STATUS: <span style="color:#20FFC9">ONLINE</span></p>
        <p style="margin: 5px 0 0 0; color: #E0E0FF">• CONTROLS: W, A, S, D</p>
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
