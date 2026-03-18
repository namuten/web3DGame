import * as THREE from 'three';

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;

// 창 크기 변경 시 렌더러 사이즈 업데이트
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});

export const mountRenderer = (elementId: string) => {
  const container = document.getElementById(elementId);
  if (container) {
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
  }
};
