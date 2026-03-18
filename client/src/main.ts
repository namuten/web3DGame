import './style.css';
import * as THREE from 'three';
import { renderer, mountRenderer } from './engine/renderer';
import { scene } from './engine/scene';
import { camera } from './engine/camera';
import { initWorld, worldCollidables } from './game/world';
import { initPlayer, updatePlayer, playerMesh } from './game/player';
import { broadcastLocalPosition, sendChatMessage, sendShoot, connectWithName } from './network/socket';
import { initHUD } from './ui/hud';
import { initChat } from './ui/chat';
import { showNameInput } from './ui/nameInput';
import { createNameTag } from './game/nameTag';
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

// 탄환 충돌 대상 등록
registerCollidables(worldCollidables);

// 플레이어 초기 세팅
initPlayer();

// HUD 초기화
initHUD();

// 채팅 초기화
initChat((msg: string) => { sendChatMessage(msg); });

// 탄환 발사 입력 초기화
initBulletInput();
setShootCallback((origin: THREE.Vector3, direction: THREE.Vector3) => {
  sendShoot(origin, direction);
});

const clock = new THREE.Clock();

const animate = () => {
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();
  updatePlayer(deltaTime);
  updateBullets(deltaTime);
  broadcastLocalPosition();
  renderer.render(scene, camera);
};

// 이름 입력 후 게임 시작
showNameInput().then((name) => {
  // 내 이름표 캐릭터에 붙이기
  const myTag = createNameTag(name);
  myTag.name = 'nameTag';
  playerMesh.add(myTag);

  // 이름 입력 후 소켓 연결 + 이름 전송
  connectWithName(name);

  animate();
});
