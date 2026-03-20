import { io, Socket } from 'socket.io-client';
import * as THREE from 'three';
import { scene } from '../engine/scene';
import { playerMesh, setPlayerColor, getUpperYaw } from '../game/player';
import { createCharacterModel } from '../game/characterModel';
import { appendMessage } from '../ui/chat';
import { addRemoteBullet, setRemotePlayerColor } from '../game/bullets';
import { createNameTag } from '../game/nameTag';
import { otherPlayers } from './players';
import { toThreeColor } from '../utils';
import type { CharacterSelection } from '../ui/characterSelect';

// autoConnect: false → 이름 입력 후 수동 연결 (이름을 쿼리로 전달)
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://220.85.41.214';
export const socket: Socket = io(SERVER_URL, { autoConnect: false });

// 이름표 스프라이트 직접 참조 Map (getObjectByName 대신)
const nameTags: Record<string, THREE.Group | THREE.Mesh> = {};

socket.on('connect', () => {
  console.log('서버에 연결되었습니다!', socket.id);
});

let localPlayerName = '나';

export const connectWithCharacter = (selection: CharacterSelection) => {
  localPlayerName = selection.playerName;
  socket.auth = {
    playerName: selection.playerName,
    characterId: selection.characterId,
    bodyColor: selection.bodyColor,
    flowerColor: selection.flowerColor,
    visorColor: selection.visorColor,
    flowerType: selection.flowerType,
  };
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
        players[id].name
      );
    } else {
      console.log(`[Socket] Setting local player info: Body=${players[id].bodyColor}, HP=${players[id].hp}`);
      setPlayerColor(
        toThreeColor(players[id].bodyColor),
        toThreeColor(players[id].flowerColor),
        toThreeColor(players[id].visorColor)
      );
      if (players[id].hp !== undefined) {
        import('../game/player').then(m => m.applyDamage(players[id].hp));
      }
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
    playerData.name
  );
});

// 각 플레이어 이동 정보 수신 (자신 제외)
socket.on('STATE_UPDATE', (updateInfo: { id: string, position: {x:number, y:number, z:number}, quaternion?: {_x:number, _y:number, _z:number, _w:number}, upperYaw?: number }) => {
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
      (otherPlayers[updateInfo.id] as any).setUpperRotation(updateInfo.upperYaw);
    }
  }
});

// 채팅 메시지 수신
socket.on('CHAT_MESSAGE', (data: { sender: string, text: string }) => {
  appendMessage(data.sender, data.text, '#00ffaa'); // 다른사람 메시지는 연두색
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
    scene.remove(otherPlayers[id]);
    delete otherPlayers[id];
    delete nameTags[id];
  }
});

// 데미지 수신 처리
socket.on('PLAYER_DAMAGED', (data: { targetId: string, hp: number, shooterId: string, direction: {x: number, y: number, z: number} }) => {
  const dir = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z);
  
  if (data.targetId === socket.id) {
    // 내가 맞았을 때
    import('../game/player').then(m => m.applyDamage(data.hp, dir));
  } else if (otherPlayers[data.targetId]) {
    // 남이 맞았을 때 (깜빡임 효과 등 나중에 추가 가능)
  }
});

// 리스폰 수신 처리
socket.on('PLAYER_RESPAWN', (data: { id: string, hp: number, position: {x: number, y: number, z: number} }) => {
  if (data.id === socket.id) {
    import('../game/player').then(m => m.respawnPlayer(data.hp, data.position));
  } else if (otherPlayers[data.id]) {
    otherPlayers[data.id].position.set(data.position.x, data.position.y, data.position.z);
  }
});

function addOtherPlayer(
  id: string,
  initialPos: { x: number; y: number; z: number },
  bodyColor: string = '#FFB7B2',
  flowerColor: string = '#FFB7B2',
  visorColor: string = '#333333',
  name: string = '익명'
) {
  if (otherPlayers[id]) return;

  const bodyNum = toThreeColor(bodyColor);
  const flowerNum = toThreeColor(flowerColor);
  const visorNum = toThreeColor(visorColor);

  setRemotePlayerColor(id, bodyNum);

  const model = createCharacterModel(bodyNum, flowerNum);
  if ((model as any).setVisorColor) (model as any).setVisorColor(visorNum);
  model.position.set(initialPos.x, initialPos.y, initialPos.z);
  model.userData = { playerId: id };

  const tag = createNameTag(name);
  model.add(tag);
  nameTags[id] = tag;

  scene.add(model);
  otherPlayers[id] = model;
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
        upperYaw: getUpperYaw()
    });
};

export const sendChatMessage = (text: string) => {
    socket.emit('CHAT_MESSAGE', { text });
    appendMessage(localPlayerName, text, '#ffcc00');
};

export const sendShoot = (origin: THREE.Vector3, direction: THREE.Vector3) => {
    socket.emit('SHOOT', {
        origin: { x: origin.x, y: origin.y, z: origin.z },
        direction: { x: direction.x, y: direction.y, z: direction.z },
    });
};
