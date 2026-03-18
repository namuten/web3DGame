import { io, Socket } from 'socket.io-client';
import * as THREE from 'three';
import { scene } from '../engine/scene';
import { playerMesh, setPlayerColor, getUpperYaw } from '../game/player';
import { createCharacterModel } from '../game/characterModel';
import { appendMessage } from '../ui/chat';
import { addRemoteBullet, setRemotePlayerColor } from '../game/bullets';
import { createNameTag } from '../game/nameTag';
import { otherPlayers } from './players';

// autoConnect: false → 이름 입력 후 수동 연결 (이름을 쿼리로 전달)
export const socket: Socket = io('http://localhost:3000', { autoConnect: false });

// 이름표 스프라이트 직접 참조 Map (getObjectByName 대신)
const nameTags: Record<string, THREE.Group | THREE.Mesh> = {};

socket.on('connect', () => {
  console.log('서버에 연결되었습니다!', socket.id);
});

let localPlayerName = '나';

// 이름을 auth에 넣고 연결 → 서버가 처음부터 이름을 알고 있음
export const connectWithName = (name: string) => {
  localPlayerName = name;
  socket.auth = { playerName: name };
  socket.connect();
};

// 다른 플레이어 이름 수신 → 이름표 교체
socket.on('PLAYER_NAME', (data: { id: string, name: string }) => {
  if (otherPlayers[data.id]) {
    if (nameTags[data.id]) otherPlayers[data.id].remove(nameTags[data.id]);
    const tag = createNameTag(data.name);
    otherPlayers[data.id].add(tag);
    nameTags[data.id] = tag;
  }
});

// 이미 있던 플레이어 정보 초기 수신
socket.on('current_players', (players: Record<string, any>) => {
  for (const id in players) {
    if (id !== socket.id) {
      addOtherPlayer(id, players[id].position, players[id].bodyColor, players[id].flowerColor, players[id].name);
    } else {
      console.log(`[Socket] Setting local player color: Body=${players[id].bodyColor}, Flower=${players[id].flowerColor}`);
      setPlayerColor(players[id].bodyColor, players[id].flowerColor);
    }
  }
});

// 신규 접속 플레이어 알림 수신
socket.on('player_joined', (playerData: { id: string, name: string, position: {x:number, y:number, z:number}, bodyColor: number, flowerColor: number, quaternion?: {_x:number, _y:number, _z:number, _w:number} }) => {
  addOtherPlayer(playerData.id, playerData.position, playerData.bodyColor, playerData.flowerColor, playerData.name);
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

function addOtherPlayer(id: string, initialPos: {x: number, y: number, z: number}, bodyColor: number = 0xffb7b2, _flowerColor: number = 0xffd1dc, name: string = '익명') {
  if(otherPlayers[id]) return;

  setRemotePlayerColor(id, bodyColor);

  const model = createCharacterModel(bodyColor, bodyColor);
  model.position.set(initialPos.x, initialPos.y, initialPos.z);

  // 이름표 추가
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
