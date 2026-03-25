import './style.css';
import * as THREE from 'three';
import { renderer, mountRenderer } from './engine/renderer';
import { scene } from './engine/scene';
import { camera } from './engine/camera';
import { initWorld, worldCollidables, updateWorld } from './game/world';
import { initPlayer, updatePlayer, playerMesh, characterModel } from './game/player';
import {
  broadcastLocalPosition,
  sendChatMessage,
  sendShoot,
  connectWithCharacter,
  joinMap,
  onMapConfig,
  onMapPlayers,
} from './network/socket';
import { initHUD } from './ui/hud';
import { initPartyUI, clearParty } from './ui/partyUI';
import { initChat } from './ui/chat';
import { showCharacterSelect } from './ui/characterSelect';
import { showLobby } from './ui/lobby';
import { createNameTag } from './game/nameTag';
import {
  initBulletInput,
  updateBullets,
  registerCollidables,
  setShootCallback,
} from './game/bullets';
import { showChatBubble, updateChatBubbles } from './game/chatBubble';
import { monsterManager } from './game/monster';

// 화면에 렌더러 등록
mountRenderer('app');

// 플레이어 초기 세팅
initPlayer();

// HUD 초기화
initHUD();
initPartyUI();

// 채팅 초기화
initChat((msg: string) => {
  sendChatMessage(msg);
  showChatBubble(playerMesh, msg);  // 로컬 플레이어 말풍선
});

// 탄환 발사 입력 초기화
initBulletInput();
setShootCallback((origin: THREE.Vector3, direction: THREE.Vector3) => {
  sendShoot(origin, direction);
});

const clock = new THREE.Clock();

const animate = () => {
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();
  const time = clock.getElapsedTime();
  updatePlayer(deltaTime);
  updateBullets(deltaTime);
  updateChatBubbles(deltaTime);
  updateWorld(time);
  monsterManager.animate(time, deltaTime, camera);
  broadcastLocalPosition();
  renderer.render(scene, camera);
};

// ─── 시작 흐름 ────────────────────────────────────────
// 1. 캐릭터 선택
showCharacterSelect().then((selection) => {
  // 2. 소켓 연결 (캐릭터 auth 포함)
  const myTag = createNameTag(selection.playerName);
  myTag.name = 'nameTag';
  if ((characterModel as any).addNameTag) {
    (characterModel as any).addNameTag(myTag);
  } else {
    playerMesh.add(myTag);
  }
  connectWithCharacter(selection);

  // MAP_PLAYERS 수신 시 로비 UI 갱신
  onMapPlayers((counts) => {
    if ((window as any).__updateLobbyMapPlayers) {
      (window as any).__updateLobbyMapPlayers(counts);
    }
  });

  // 3. 로비 표시 (맵 선택)
  showLobby().then((selectedMapId) => {
    // 4. MAP_CONFIG 수신 대기 등록
    onMapConfig((config) => {
      // 5. 맵 초기화
      clearParty(); // 클리어 파티
      initWorld(config);

      // 캐릭터 시작 위치 랜덤화 (로컬에서 즉시 반영)
      const pZone = config.playZone || 80;
      const rx = (Math.random() - 0.5) * pZone * 0.8;
      const rz = (Math.random() - 0.5) * pZone * 0.8;
      playerMesh.position.set(rx, 1, rz);

      // 탄환 충돌 대상 등록
      registerCollidables(worldCollidables);

      // 6. 게임 루프 시작
      animate();
    });

    // 7. JOIN_MAP 전송 (서버에서 MAP_CONFIG 화답 유도)
    joinMap(selectedMapId);
  });
});
