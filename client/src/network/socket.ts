import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from './config';
import * as THREE from 'three';

import { scene } from '../engine/scene';
import { playerMesh, setPlayerColor, getUpperYaw, getUpperPitch } from '../game/player';
import { createCharacterModel } from '../game/characterModel';
import { appendMessage } from '../ui/chat';
import { addRemoteBullet, setRemotePlayerColor } from '../game/bullets';
import { showChatBubble, removeChatBubble } from '../game/chatBubble';
import { createNameTag } from '../game/nameTag';
import { otherPlayers } from './players';
import { toThreeColor } from '../utils';
import type { CharacterSelection } from '../ui/characterSelect';
import type { MapConfig } from '../types/map';
import type { MonsterData } from '../game/monster';
import { monsterManager } from '../game/monster';
import { addPartyMember, updatePartyMemberHP, removePartyMember } from '../ui/partyUI';
import { renderSnapshot } from '../ui/characterSelect';
import { soundManager } from '../audio/soundManager';
import { tts } from '../tts/tts';
import { registerPlayerVoice, getVoiceOptions, unregisterPlayerVoice } from '../tts/characterVoices';

// autoConnect: false → 이름 입력 후 수동 연결 (이름을 쿼리로 전달)
// autoConnect: false → 이름 입력 후 수동 연결 (이름을 쿼리로 전달)
export const socket: Socket = io(SERVER_URL, { autoConnect: false });


// 이름표 스프라이트 직접 참조 Map (getObjectByName 대신)
const nameTags: Record<string, THREE.Group | THREE.Mesh> = {};

socket.on('connect', () => {
  console.log('서버에 연결되었습니다!', socket.id);
});

let localPlayerName = '나';
let localSelection: CharacterSelection | null = null;

export const connectWithCharacter = (selection: CharacterSelection) => {
  localPlayerName = selection.playerName;
  localSelection = selection;
  socket.auth = {
    playerName: selection.playerName,
    characterId: selection.characterId,
    bodyColor: selection.bodyColor,
    flowerColor: selection.flowerColor,
    visorColor: selection.visorColor,
    flowerType: selection.flowerType,
    visorType: selection.visorType,
    voiceId: selection.voiceId,
  };
  registerPlayerVoice('local', selection.voiceId);
  socket.connect();
};

// 이미 있던 플레이어 정보 초기 수신
socket.on('current_players', (players: Record<string, any>) => {
  for (const id in players) {
    if (id !== socket.id) {
      addOtherPlayer(
        id,
        players[id].position,
        players[id].bodyColor,
        players[id].flowerColor,
        players[id].visorColor,
        players[id].name,
        players[id].flowerType,
        players[id].visorType,
        players[id].hp
      );
      registerPlayerVoice(id, players[id].voiceId || players[id].flowerType);
    } else {
      console.log(`[Socket] Setting local player info: Body=${players[id].bodyColor}, HP=${players[id].hp}`);
      setPlayerColor(
        toThreeColor(players[id].bodyColor),
        toThreeColor(players[id].flowerColor),
        toThreeColor(players[id].visorColor),
        players[id].flowerType,
        players[id].visorType
      );
      if (players[id].hp !== undefined) {
        import('../game/player').then(m => m.applyDamage(players[id].hp));
      }
      const myInfo = localSelection || players[id];
      renderSnapshot({
        bodyColor: myInfo.bodyColor,
        flowerColor: myInfo.flowerColor,
        visorColor: myInfo.visorColor,
        flowerType: myInfo.flowerType,
        visorType: myInfo.visorType
      }).then(imgUrl => {
        addPartyMember('local', localPlayerName, players[id].hp ?? 100, imgUrl);
      });
    }
  }
});

// 신규 접속 플레이어 알림 수신
socket.on('player_joined', (playerData: any) => {
  addOtherPlayer(
    playerData.id,
    playerData.position,
    playerData.bodyColor,
    playerData.flowerColor,
    playerData.visorColor,
    playerData.name,
    playerData.flowerType,
    playerData.visorType,
    playerData.hp
  );
  registerPlayerVoice(playerData.id, playerData.voiceId || playerData.flowerType);
});

// 각 플레이어 이동 정보 수신 (자신 제외)
socket.on('STATE_UPDATE', (updateInfo: { id: string, position: { x: number, y: number, z: number }, quaternion?: { _x: number, _y: number, _z: number, _w: number }, upperYaw?: number, upperPitch?: number }) => {
  if (otherPlayers[updateInfo.id]) {
    otherPlayers[updateInfo.id].position.set(
      updateInfo.position.x,
      updateInfo.position.y,
      updateInfo.position.z
    );
    if (updateInfo.quaternion) {
      otherPlayers[updateInfo.id].quaternion.set(
        updateInfo.quaternion._x,
        updateInfo.quaternion._y,
        updateInfo.quaternion._z,
        updateInfo.quaternion._w
      );
    }
    if (updateInfo.upperYaw !== undefined && (otherPlayers[updateInfo.id] as any).setUpperRotation) {
      (otherPlayers[updateInfo.id] as any).setUpperRotation(updateInfo.upperYaw, updateInfo.upperPitch || 0);
    }
  }
});

// 채팅 메시지 수신
socket.on('CHAT_MESSAGE', (data: { sender: string, senderId: string, text: string }) => {
  appendMessage(data.sender, data.text, '#00ffaa');

  // TTS 재생 (활성화 시에만, 시스템/디버깅 메시지 제외)
  const senderUpper = data.sender.toUpperCase();
  const isSystemMsg = senderUpper.includes('SYSTEM') || senderUpper.includes('DEBUG');

  if (soundManager.isTTSEnabled() && !isSystemMsg) {
    const voiceId = data.senderId === socket.id ? 'local' : data.senderId;
    const opts = getVoiceOptions(voiceId);
    tts.speak(data.text, opts, voiceId); // senderId 전달
  }

  if (data.senderId && otherPlayers[data.senderId]) {
    showChatBubble(otherPlayers[data.senderId], data.text);
  }
});

// 원격 플레이어 탄환 수신
socket.on('SHOOT', (data: {
  id: string,
  origin: { x: number, y: number, z: number },
  direction: { x: number, y: number, z: number }
}) => {
  addRemoteBullet(data.origin, data.direction, data.id);
});

// 접속 종료 플레이어 수신 (월드에서 삭제)
socket.on('player_left', (id: string) => {
  if (otherPlayers[id]) {
    removeChatBubble(otherPlayers[id]);
    scene.remove(otherPlayers[id]);
    delete otherPlayers[id];
    delete nameTags[id];
    removePartyMember(id);
    unregisterPlayerVoice(id);
  }
});

// 데미지 수신 처리
socket.on('PLAYER_DAMAGED', (data: { targetId: string, hp: number, shooterId: string, direction: { x: number, y: number, z: number } }) => {
  const dir = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z);

  if (data.targetId === socket.id) {
    // 내가 맞았을 때
    import('../game/player').then(m => m.applyDamage(data.hp, dir));
    updatePartyMemberHP('local', data.hp);
  } else if (otherPlayers[data.targetId]) {
    // 남이 맞았을 때
    updatePartyMemberHP(data.targetId, data.hp);
  }
});

// 리스폰 수신 처리
socket.on('PLAYER_RESPAWN', (data: { id: string, hp: number, position: { x: number, y: number, z: number } }) => {
  if (data.id === socket.id) {
    import('../game/player').then(m => m.respawnPlayer(data.hp, data.position));
    updatePartyMemberHP('local', data.hp);
  } else if (otherPlayers[data.id]) {
    otherPlayers[data.id].position.set(data.position.x, data.position.y, data.position.z);
    updatePartyMemberHP(data.id, data.hp);
  }
});

function addOtherPlayer(
  id: string,
  initialPos: { x: number; y: number; z: number },
  bodyColor: string = '#FFB7B2',
  flowerColor: string = '#FFB7B2',
  visorColor: string = '#333333',
  name: string = '익명',
  flowerType: string = 'daisy',
  visorType: string = 'normal',
  hp: number = 100
) {
  if (otherPlayers[id]) return;

  const bodyNum = toThreeColor(bodyColor);
  const flowerNum = toThreeColor(flowerColor);
  const visorNum = toThreeColor(visorColor);

  setRemotePlayerColor(id, bodyNum);

  const model = createCharacterModel(bodyNum, flowerNum, flowerType, visorType);
  if ((model as any).setVisorStyle) {
    (model as any).setVisorStyle(visorNum, visorType);
  } else if ((model as any).setVisorColor) {
    (model as any).setVisorColor(visorNum);
  }
  model.position.set(initialPos.x, initialPos.y, initialPos.z);
  model.userData = { playerId: id };

  const tag = createNameTag(name);
  if ((model as any).addNameTag) {
    (model as any).addNameTag(tag);
  } else {
    model.add(tag);
  }
  nameTags[id] = tag;

  scene.add(model);
  otherPlayers[id] = model;

  renderSnapshot({
    bodyColor, flowerColor, visorColor, flowerType, visorType
  }).then(imgUrl => {
    addPartyMember(id, name, hp, imgUrl);
  });
}

// 초당 20회 강제 전송 (딜레이 최소화)
const BROADCAST_INTERVAL = 1000 / 20;
let lastBroadcastTime = 0;

export const broadcastLocalPosition = () => {
  const now = performance.now();
  if (now - lastBroadcastTime < BROADCAST_INTERVAL) return;
  lastBroadcastTime = now;

  socket.emit('MOVE', {
    position: {
      x: playerMesh.position.x,
      y: playerMesh.position.y,
      z: playerMesh.position.z
    },
    quaternion: {
      _x: playerMesh.quaternion.x,
      _y: playerMesh.quaternion.y,
      _z: playerMesh.quaternion.z,
      _w: playerMesh.quaternion.w
    },
    upperYaw: getUpperYaw(),
    upperPitch: getUpperPitch()
  });
};

export const sendChatMessage = (text: string) => {
  socket.emit('CHAT_MESSAGE', { text });
  appendMessage(localPlayerName, text, '#ffcc00');

  // 내 메시지 TTS (자청해서 듣기 - 활성화 시에만)
  if (soundManager.isTTSEnabled()) {
    const opts = getVoiceOptions('local');
    tts.speak(text, opts, 'local'); // 자신은 'local'로 구분
  }
};

export const sendShoot = (origin: THREE.Vector3, direction: THREE.Vector3) => {
  socket.emit('SHOOT', {
    origin: { x: origin.x, y: origin.y, z: origin.z },
    direction: { x: direction.x, y: direction.y, z: direction.z },
  });
};

// ─── 몬스터 시스템 추가 ───────────────────────────────────

socket.on('MONSTER_SPAWN', (data: MonsterData) => {
  monsterManager.spawn(data);
  const msg = '도망가세요!';
  appendMessage('Boss Slime', msg, '#ff0000');

  // 시스템 음성 안내
  tts.speak(msg, { voice: 'Grandpa', rate: 0.8, pitch: 0.5 });

  // 몬스터 등장 오버레이 표시
  const banner = document.createElement('div');
  banner.style.cssText = `
        position: fixed; top: 20%; left: 50%; translate: -50% -50%;
        color: #ff0000; font-size: 60px; font-weight: bold; font-family: sans-serif;
        text-shadow: 0 0 20px black; pointer-events: none; z-index: 10000;
        animation: blink 0.5s infinite alternate;
    `;
  banner.innerText = "⚠️ WARNING: BOSS SLIME SPAWNED!";
  document.body.appendChild(banner);

  const style = document.createElement('style');
  style.textContent = `@keyframes blink { from { opacity: 1; } to { opacity: 0.5; } }`;
  document.head.appendChild(style);

  setTimeout(() => { if (banner.parentNode) banner.remove(); }, 5000);
});

socket.on('MONSTER_UPDATE', (data: { id: string, position: { x: number, y: number, z: number } }) => {
  monsterManager.update(data);
});

socket.on('MONSTER_DAMAGED', (data: { id: string, hp: number, maxHp: number, scale?: number }) => {
  monsterManager.damage(data.hp, data.maxHp, data.scale || 1.0);
});

socket.on('MONSTER_DEFEATED', (_data: { id: string }) => {
  monsterManager.remove();
  // 이펙트나 UI 처리가 필요하다면 추가
});

socket.on('MONSTER_WIN', (data: { message: string }) => {
  appendMessage('Boss Slime', '모든 플레이어를 처치했습니다! 슬라임 승리!', '#ff0000');

  // UI 오버레이 표시 (나중에 고도화 가능)
  const overlay = document.createElement('div');
  overlay.style.cssText = `
        position: fixed; top: 50%; left: 50%; translate: -50% -50%;
        color: white; font-size: 40px; font-weight: bold; background: rgba(0,0,0,0.8);
        padding: 40px; border-radius: 20px; text-shadow: 0 0 10px red;
        z-index: 10000;
    `;
  overlay.textContent = data.message;
  document.body.appendChild(overlay);
  setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 4000);
});

export const joinMap = (mapId: number) => {
  socket.emit('JOIN_MAP', { mapId });
};

export const onMapConfig = (callback: (config: MapConfig) => void) => {
  socket.on('MAP_CONFIG', callback);
};

export const onMapPlayers = (callback: (counts: Record<string, number>) => void) => {
  socket.on('MAP_PLAYERS', callback);
};
