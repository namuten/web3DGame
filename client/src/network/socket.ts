import { io, Socket } from 'socket.io-client';
import * as THREE from 'three';
import { scene } from '../engine/scene';
import { playerMesh } from '../game/player';
import { appendMessage } from '../ui/chat';
import { addRemoteBullet } from '../game/bullets';

// 서버 포트 3000에 연결
export const socket: Socket = io('http://localhost:3000');

// 다른 플레이어 메쉬들을 저장 (key=socketId, value=THREE.Group)
const otherPlayers: Record<string, THREE.Group> = {};
const otherPlayerGeo = new THREE.CapsuleGeometry(0.5, 1, 4, 16);
const otherPlayerMat = new THREE.MeshStandardMaterial({ color: 0xf72585, roughness: 0.2, metalness: 0.8 });

socket.on('connect', () => {
  console.log('서버에 연결되었습니다!', socket.id);
});

// 이미 있던 플레이어 정보 초기 수신
socket.on('current_players', (players: Record<string, any>) => {
  for (const id in players) {
    if (id !== socket.id) {
      addOtherPlayer(id, players[id].position);
    }
  }
});

// 신규 접속 플레이어 알림 수신
socket.on('player_joined', (playerData: { id: string, position: {x:number, y:number, z:number}, quaternion?: {_x:number, _y:number, _z:number, _w:number} }) => {
  console.log('새 플레이어 접근!', playerData.id);
  addOtherPlayer(playerData.id, playerData.position);
});

// 각 플레이어 이동 정보 수신 (자신 제외)
socket.on('STATE_UPDATE', (updateInfo: { id: string, position: {x:number, y:number, z:number}, quaternion?: {_x:number, _y:number, _z:number, _w:number} }) => {
  if (otherPlayers[updateInfo.id]) {
    otherPlayers[updateInfo.id].position.set(
      updateInfo.position.x,
      updateInfo.position.y,
      updateInfo.position.z
    );
    if(updateInfo.quaternion) {
      // 쿼터니언 업데이트 (회전 동기화)
      otherPlayers[updateInfo.id].quaternion.set(
        updateInfo.quaternion._x,
        updateInfo.quaternion._y,
        updateInfo.quaternion._z,
        updateInfo.quaternion._w
      );
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
  }
});

function addOtherPlayer(id: string, initialPos: {x: number, y: number, z: number}) {
  if(otherPlayers[id]) return; // 이미 있으면 추가 x

  const group = new THREE.Group();
  
  const body = new THREE.Mesh(otherPlayerGeo, otherPlayerMat);
  body.castShadow = true;
  body.receiveShadow = true;
  body.position.y = 1;

  const visorGeo = new THREE.BoxGeometry(0.7, 0.3, 0.3);
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.9 });
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 1.4, -0.45);
  
  group.add(body);
  group.add(visor);

  group.position.set(initialPos.x, initialPos.y, initialPos.z);
  scene.add(group);
  otherPlayers[id] = group;
}

// 지속적으로 내 위치 서버로 브로드캐스트. 
// 최적화: 위치가 바뀐 경우에만 전송
let lastPosX = playerMesh.position.x;
let lastPosZ = playerMesh.position.z;

export const broadcastLocalPosition = () => {
    // 이동 또는 회전 체크 오차 (소수점)
    if (Math.abs(playerMesh.position.x - lastPosX) > 0.01 || Math.abs(playerMesh.position.z - lastPosZ) > 0.01) {
        lastPosX = playerMesh.position.x;
        lastPosZ = playerMesh.position.z;
        
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
            }
        });
    }
};

export const sendChatMessage = (text: string) => {
    socket.emit('CHAT_MESSAGE', { text });
    appendMessage(socket.id || 'Me', text, '#ffcc00'); // 내가 보낸 건 노란색으로 처리
};

export const sendShoot = (origin: THREE.Vector3, direction: THREE.Vector3) => {
    socket.emit('SHOOT', {
        origin: { x: origin.x, y: origin.y, z: origin.z },
        direction: { x: direction.x, y: direction.y, z: direction.z },
    });
};
