import { io, Socket } from 'socket.io-client';
import * as THREE from 'three';
import { scene } from '../engine/scene';
import { playerMesh, setPlayerColor } from '../game/player';
import { createCharacterModel } from '../game/characterModel';
import { appendMessage } from '../ui/chat';
import { addRemoteBullet } from '../game/bullets';
import { otherPlayers } from './players';

// 서버 포트 3000에 연결
export const socket: Socket = io('http://localhost:3000');

// 다른 플레이어 메쉬들을 저장 (key=socketId, value=THREE.Group)

socket.on('connect', () => {
  console.log('서버에 연결되었습니다!', socket.id);
});

// 이미 있던 플레이어 정보 초기 수신
socket.on('current_players', (players: Record<string, any>) => {
  for (const id in players) {
    if (id !== socket.id) {
      addOtherPlayer(id, players[id].position, players[id].bodyColor, players[id].flowerColor);
    } else {
      console.log(`[Socket] Setting local player color: Body=${players[id].bodyColor}, Flower=${players[id].flowerColor}`);
      setPlayerColor(players[id].bodyColor, players[id].flowerColor);
    }
  }
});

// 신규 접속 플레이어 알림 수신
socket.on('player_joined', (playerData: { id: string, position: {x:number, y:number, z:number}, bodyColor: number, flowerColor: number, quaternion?: {_x:number, _y:number, _z:number, _w:number} }) => {
  console.log(`[Socket] New player joined: ${playerData.id}, Body=${playerData.bodyColor}, Flower=${playerData.flowerColor}`);
  addOtherPlayer(playerData.id, playerData.position, playerData.bodyColor, playerData.flowerColor);
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

function addOtherPlayer(id: string, initialPos: {x: number, y: number, z: number}, bodyColor: number = 0xffb7b2, flowerColor: number = 0xffd1dc) {
  if(otherPlayers[id]) return; 

  // 신형 캐릭터 모델 생성 
  const model = createCharacterModel(bodyColor, flowerColor);
  
  // 위치 설정
  model.position.set(initialPos.x, initialPos.y, initialPos.z);
  scene.add(model);
  otherPlayers[id] = model;
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
