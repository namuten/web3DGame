import './style.css';
import * as THREE from 'three';
import { renderer, mountRenderer } from './engine/renderer';
import { scene } from './engine/scene';
import { camera } from './engine/camera';
import { initWorld, worldCollidables } from './game/world';
import { initPlayer, updatePlayer } from './game/player';
import { broadcastLocalPosition, sendChatMessage, sendShoot } from './network/socket';
import { initHUD } from './ui/hud';
import { initChat } from './ui/chat';
import {
  initBulletInput,
  updateBullets,
  registerCollidables,
  setShootCallback,
} from './game/bullets';

// 화면에 렌더러 등록
mountRenderer('app');

// 월드(조명, 장애물, 맵 등) 초기화
initWorld();

// 탄환 충돌 대상 등록 (world에서 생성된 장애물들)
registerCollidables(worldCollidables);

// 플레이어 초기 세팅
initPlayer();

// HUD 초기화
initHUD();

// 채팅 초기화 및 소켓 전송 함수 연결
initChat((msg: string) => {
  sendChatMessage(msg);
});

// 탄환 발사 입력 초기화 + 서버 브로드캐스트 콜백 연결
initBulletInput();
setShootCallback((origin: THREE.Vector3, direction: THREE.Vector3) => {
  sendShoot(origin, direction);
});

const clock = new THREE.Clock(); // deltaTime 측정을 위한 Clock 생성

// 메인 루프 (매 프레임 실행)
const animate = () => {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  // 플레이어 입력 및 위치 계산 적용
  updatePlayer(deltaTime);

  // 탄환 이동 + 충돌 판정 업데이트
  updateBullets(deltaTime);

  broadcastLocalPosition(); // 소켓을 통해 변경된 위치 서버로 브로드캐스트

  // 렌더링 처리
  renderer.render(scene, camera);
};

// 애니메이션 시작
animate();
