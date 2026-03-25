import * as THREE from 'three';

interface ActiveBubble {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  timeLeft: number;
}

const SHOW_DURATION = 2.0;
const FADE_DURATION = 1.0;
const BUBBLE_Y = 3.6;

const bubbles = new Map<THREE.Object3D, ActiveBubble>();

function removeBubble(mesh: THREE.Object3D, bubble: ActiveBubble) {
  mesh.remove(bubble.sprite);
  bubble.material.map?.dispose();
  bubble.material.dispose();
  bubbles.delete(mesh);
}

function createBubbleTexture(text: string): THREE.CanvasTexture {
  const W = 768, H = 280;
  const TAIL = 28;
  const RADIUS = 28;
  const PAD_X = 40;
  const bubbleH = H - TAIL;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, W, H);

  ctx.beginPath();
  ctx.moveTo(RADIUS, 0);
  ctx.lineTo(W - RADIUS, 0);
  ctx.quadraticCurveTo(W, 0, W, RADIUS);
  ctx.lineTo(W, bubbleH - RADIUS);
  ctx.quadraticCurveTo(W, bubbleH, W - RADIUS, bubbleH);
  ctx.lineTo(W / 2 + TAIL, bubbleH);
  ctx.lineTo(W / 2, H);
  ctx.lineTo(W / 2 - TAIL, bubbleH);
  ctx.lineTo(RADIUS, bubbleH);
  ctx.quadraticCurveTo(0, bubbleH, 0, bubbleH - RADIUS);
  ctx.lineTo(0, RADIUS);
  ctx.quadraticCurveTo(0, 0, RADIUS, 0);
  ctx.closePath();

  ctx.fillStyle = 'rgba(8, 8, 22, 0.90)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(160, 200, 255, 0.45)';
  ctx.lineWidth = 3;
  ctx.stroke();

  let fontSize = 56;
  do {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px "Noto Sans KR", sans-serif`;
  } while (ctx.measureText(text).width > W - PAD_X * 2 && fontSize > 28);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, bubbleH / 2, W - PAD_X * 2);

  ctx.shadowColor = 'transparent';

  return new THREE.CanvasTexture(canvas);
}

export const showChatBubble = (parentMesh: THREE.Object3D, text: string) => {
  const existing = bubbles.get(parentMesh);
  if (existing) removeBubble(parentMesh, existing);

  const texture = createBubbleTexture(text);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);

  sprite.scale.set(3.5, 1.28, 1.0);
  sprite.position.set(0, BUBBLE_Y, 0);

  parentMesh.add(sprite);
  bubbles.set(parentMesh, { sprite, material, timeLeft: SHOW_DURATION + FADE_DURATION });
};

export const removeChatBubble = (parentMesh: THREE.Object3D) => {
  const existing = bubbles.get(parentMesh);
  if (existing) removeBubble(parentMesh, existing);
};

export const updateChatBubbles = (deltaTime: number) => {
  for (const [mesh, bubble] of bubbles) {
    bubble.timeLeft -= deltaTime;

    if (bubble.timeLeft <= 0) {
      removeBubble(mesh, bubble);
    } else if (bubble.timeLeft < FADE_DURATION) {
      bubble.material.opacity = bubble.timeLeft / FADE_DURATION;
    }
  }
};
