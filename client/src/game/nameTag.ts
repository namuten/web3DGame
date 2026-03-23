import * as THREE from 'three';

// 흰색 단색 팔레트
const GRAFFITI_PALETTE = Array(8).fill({ main: '#ffffff', shadow: '#888888', hi: '#ffffff' });

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const len = i % 2 === 0 ? r : r * 0.4;
    if (i === 0) ctx.moveTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    else ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export const createNameTag = (name: string): THREE.Group => {
  const group = new THREE.Group();

  const W = 640, H = 320;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);

  // 텍스트 길이에 따른 동적 폰트 크기 계산 (최소 100px ~ 최대 220px)
  let fontSize = 220;
  if (name.length > 5) {
    fontSize = Math.max(100, Math.floor(220 * (6.5 / name.length)));
  }

  ctx.font = `900 ${fontSize}px Arial Black, Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let chars = name.split('');
  let charWidths = chars.map(ch => ctx.measureText(ch).width);
  let totalW = charWidths.reduce((a, b) => a + b, 0);

  // 캔버스 너비를 초과할 경우 전체적으로 축소
  const maxSafeW = W - 60; // 좌우 여백 30씩
  if (totalW > maxSafeW) {
    const scale = maxSafeW / totalW;
    fontSize = Math.floor(fontSize * scale);
    ctx.font = `900 ${fontSize}px Arial Black, Impact, sans-serif`;
    charWidths = chars.map(ch => ctx.measureText(ch).width);
    totalW = charWidths.reduce((a, b) => a + b, 0);
  }

  let startX = W / 2 - totalW / 2;

  // ── 배경: 각 글자 뒤 스프레이 구름 ──
  for (let ci = 0; ci < chars.length; ci++) {
    const cw = charWidths[ci];
    const cx = startX + cw / 2;
    const pal = GRAFFITI_PALETTE[ci % GRAFFITI_PALETTE.length];

    // 컬러 헤이즈 (넓게 번진 글자 배경색)
    for (let i = 0; i < 500; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.pow(Math.random(), 0.2) * 100;
      ctx.globalAlpha = Math.random() * 0.5 * (1 - dist / 110);
      ctx.fillStyle = pal.main;
      ctx.beginPath();
      ctx.arc(
        cx + Math.cos(angle) * dist * 1.7,
        H / 2 + Math.sin(angle) * dist * 1.1,
        Math.random() * 5, 0, Math.PI * 2
      );
      ctx.fill();
    }
    startX += cw;
  }

  // ── 글자 렌더링 ──
  startX = W / 2 - totalW / 2;
  for (let ci = 0; ci < chars.length; ci++) {
    const ch = chars[ci];
    const cw = charWidths[ci];
    const cx = startX + cw / 2;
    const pal = GRAFFITI_PALETTE[ci % GRAFFITI_PALETTE.length];

    ctx.save();
    // 글자별 약간의 기울기/흔들림
    ctx.translate(cx + (Math.random() - 0.5) * 8, H / 2 + (Math.random() - 0.5) * 6);
    ctx.rotate((Math.random() - 0.5) * 0.18);
    ctx.scale(1 + (Math.random() - 0.5) * 0.08, 1 + (Math.random() - 0.5) * 0.1);

    // 1. 3D 압출(extrusion) — 그림자 방향으로 여러 레이어
    const extSteps = 8;
    for (let s = extSteps; s >= 1; s--) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = pal.shadow;
      ctx.fillText(ch, s * 1.8, s * 1.8);
    }

    // 2. 두꺼운 검은 아웃라인
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 20;
    ctx.lineJoin = 'round';
    ctx.strokeText(ch, 0, 0);

    // 3. 메인 컬러 그라디언트 채우기
    const grad = ctx.createLinearGradient(0, -fontSize * 0.5, 0, fontSize * 0.5);
    grad.addColorStop(0, pal.hi);
    grad.addColorStop(0.35, pal.main);
    grad.addColorStop(1.0, pal.shadow);
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = grad;
    ctx.fillText(ch, 0, 0);

    // 4. 얇은 흰 테두리 (크롬 느낌)
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeText(ch, 0, 0);

    // 5. 상단 크롬 하이라이트 (글자 위쪽 빛 반사)
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(ch, -2, -fontSize * 0.12);

    // 6. 컬러 드립 (흘러내리는 페인트)
    const dripCount = Math.floor(Math.random() * 3) + 1;
    for (let d = 0; d < dripCount; d++) {
      if (Math.random() < 0.7) {
        const dripX = (Math.random() - 0.5) * cw * 0.55;
        const dripLen = Math.random() * 60 + 25;
        const dripW = Math.random() * 7 + 3;
        ctx.globalAlpha = 0.7 + Math.random() * 0.3;
        // 드립 몸통
        ctx.beginPath();
        ctx.moveTo(dripX - dripW / 2, fontSize * 0.38);
        ctx.bezierCurveTo(
          dripX - dripW / 2, fontSize * 0.38 + dripLen * 0.4,
          dripX + dripW / 2, fontSize * 0.38 + dripLen * 0.6,
          dripX, fontSize * 0.38 + dripLen
        );
        ctx.bezierCurveTo(
          dripX - dripW / 2, fontSize * 0.38 + dripLen * 0.6,
          dripX + dripW / 2, fontSize * 0.38 + dripLen * 0.4,
          dripX + dripW / 2, fontSize * 0.38
        );
        ctx.closePath();
        ctx.fillStyle = pal.main;
        ctx.fill();
        // 드립 끝 방울
        ctx.beginPath();
        ctx.arc(dripX, fontSize * 0.38 + dripLen, dripW * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = pal.main;
        ctx.fill();
      }
    }

    ctx.restore();
    startX += cw;
  }

  // ── 장식 요소: 별, 크로스, 점 ──
  ctx.globalAlpha = 1.0;
  const decorCount = 18;
  for (let i = 0; i < decorCount; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const pal = GRAFFITI_PALETTE[Math.floor(Math.random() * GRAFFITI_PALETTE.length)];
    const r = Math.random() * 10 + 4;
    const alpha = 0.5 + Math.random() * 0.5;

    if (Math.random() < 0.5) {
      // 6각 별
      drawStar(ctx, x, y, r, pal.hi, alpha);
    } else {
      // 크로스/플러스 마크
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = pal.hi;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
      ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 전체 스프레이 노이즈 입자
  for (let i = 0; i < 200; i++) {
    ctx.globalAlpha = Math.random() * 0.18;
    const pal = GRAFFITI_PALETTE[Math.floor(Math.random() * GRAFFITI_PALETTE.length)];
    ctx.fillStyle = pal.main;
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1.0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16;

  // 캔버스가 커졌으니 arc도 약간 크게
  const arcGeo = new THREE.CylinderGeometry(
    0.56, 0.56, 0.6,
    24, 1, true,
    Math.PI - 0.7, 1.4
  );

  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const arc = new THREE.Mesh(arcGeo, mat);
  arc.position.y = 1.3; // 등 중앙에 위치
  group.add(arc);

  return group;
};
