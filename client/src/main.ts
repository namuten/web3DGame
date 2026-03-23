import './style.css';
import * as THREE from 'three';
import { renderer, mountRenderer } from './engine/renderer';
import { scene } from './engine/scene';
import { camera } from './engine/camera';
import { initWorld, worldCollidables } from './game/world';
import { initPlayer, updatePlayer, playerMesh, characterModel } from './game/player';
import { broadcastLocalPosition, sendChatMessage, sendShoot, connectWithCharacter } from './network/socket';
import { initHUD } from './ui/hud';
import { initChat } from './ui/chat';
import { showCharacterSelect } from './ui/characterSelect';
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

// 캐릭터 선택 후 게임 시작
showCharacterSelect().then((selection) => {
  const myTag = createNameTag(selection.playerName);
  myTag.name = 'nameTag';
  // 상체에 부착 (상체 회전 시 같이 움직이게 함)
  if ((characterModel as any).addNameTag) {
    (characterModel as any).addNameTag(myTag);
  } else {
    playerMesh.add(myTag);
  }

  connectWithCharacter(selection);

  animate();
});
