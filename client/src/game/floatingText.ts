import * as THREE from 'three';
import { scene } from '../engine/scene';

interface FloatingText {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  life: number;
  initialScale: number;
}

const floatingTexts: FloatingText[] = [];

/**
 * 데미지 숫자를 생성하고 캐릭터 위에 띄웁니다.
 * offsetY 인자를 통해 충격 지점으로부터 얼마나 위로 띄울지 결정할 수 있습니다.
 */
export const showDamageText = (pos: THREE.Vector3, amount: number, color: string = '#ffff00', offsetY: number = 3.5) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  
  // 텍스트 스타일 설정 (black -> 900 으로 수정하여 표준 호환성 확보)
  ctx.font = '900 160px "Arial Black", sans-serif';
  ctx.fillStyle = color;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 14;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // 그림자 효과
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 4;
  
  // 외곽선과 텍스트 그리기
  ctx.strokeText(amount.toString(), 256, 128);
  ctx.fillText(amount.toString(), 256, 128);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true; // 텍스트 갱신 명시
  
  const material = new THREE.SpriteMaterial({ 
    map: texture, 
    transparent: true,
    depthTest: false // 장애물 너머에서도 보이게 설정
  });
  
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 999; // 다른 오브젝트보다 항상 위에 렌더링
  
  // 캐릭터 머리 위 더 높은 위치에 배치 (가시성 확보)
  sprite.position.copy(pos).add(new THREE.Vector3(0, offsetY, 0));
  
  const baseScale = 3.0; // 스케일 더욱 증대
  sprite.scale.set(baseScale, baseScale * 0.5, 1);
  
  scene.add(sprite);
  
  floatingTexts.push({
    sprite,
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 2, 
      5.0 + Math.random() * 2, 
      (Math.random() - 0.5) * 2
    ),
    life: 1.0, 
    initialScale: baseScale
  });
};

/**
 * 매 프레임 업데이트하여 텍스트를 위로 올리고 애니메이션 처리합니다.
 */
export const updateFloatingTexts = (dt: number) => {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.life -= dt;
    
    if (ft.life <= 0) {
      scene.remove(ft.sprite);
      ft.sprite.material.dispose();
      ft.sprite.material.map?.dispose();
      floatingTexts.splice(i, 1);
      continue;
    }
    
    // 위치 이동 (속도 가산)
    ft.sprite.position.add(ft.velocity.clone().multiplyScalar(dt));
    // 중력 적용
    ft.velocity.y -= 10.0 * dt;
    
    // 팝업 애니메이션 효과 (초기에 커졌다가 작아짐)
    const progress = ft.life / 0.8; // 1.0 -> 0.0
    const scaleFactor = Math.sin(progress * Math.PI) * 1.2; // 0 -> 1.2 -> 0 주기의 변형
    const currentScale = ft.initialScale * (0.5 + scaleFactor * 0.5);
    ft.sprite.scale.set(currentScale, currentScale * 0.5, 1);
    
    // 투명도 조절 (마지막에 급격히 페이드 아웃)
    ft.sprite.material.opacity = Math.min(1.0, progress * 2.0);
  }
};
