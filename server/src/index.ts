import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import characterRoutes from './routes/characters.js';

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB 연결
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/web3dgame';
mongoose.connect(MONGO_URL)
  .then(() => console.log('✅ MongoDB 연결 성공'))
  .catch((err) => console.error('❌ MongoDB 연결 실패:', err));

// 캐릭터 API 라우터
app.use('/api/characters', characterRoutes);

app.get('/', (_req, res) => res.send('OK'));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // 개발 단계이므로 모든 origin 허용
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

// 접속한 플레이어들의 상태를 메모리에 잠시 저장
const players: Record<string, any> = {};

const DEFAULT_ROOM = 'Lobby';

io.on('connection', (socket: Socket) => {
  console.log(`플레이어 접속: ${socket.id}`);

  // 기본 방에 접속시킴 (Room Scaling)
  socket.join(DEFAULT_ROOM);

  // 새로운 플레이어 생성 (초기 위치, 회전값, 접속한 방, 색상 추가)
  const bodyColors = [0xff6b6b, 0xff9f43, 0xffd32a, 0x6bcb77, 0x4dabf7, 0xcc5de8, 0xff6eb4, 0x38d9a9];

  const playerName = String((socket.handshake.auth as any)?.playerName || '익명').slice(0, 12);

  players[socket.id] = {
    id: socket.id,
    name: playerName,
    room: DEFAULT_ROOM,
    position: { x: 0, y: 1, z: 0 },
    quaternion: { _x: 0, _y: 0, _z: 0, _w: 1 },
    bodyColor: bodyColors[Math.floor(Math.random() * bodyColors.length)],
    flowerColor: 0xffffff,
    hp: 100, // HP 초기화
  };

  // 이름 설정 이벤트
  socket.on('SET_NAME', (name: string) => {
    if (players[socket.id]) {
      players[socket.id].name = String(name).slice(0, 12) || '익명';
      socket.to(players[socket.id].room).emit('PLAYER_NAME', {
        id: socket.id,
        name: players[socket.id].name,
      });
    }
  });

  // 기존 접속자들에게 새 플레이어 알림 (방 안에만)
  socket.to(DEFAULT_ROOM).emit('player_joined', players[socket.id]);

  // 새 접속자에게는 현재 방에 있는 모든 플레이어 정보 전달
  // 전체 접속자가 아니라 해당 방의 접속자만 필터링해서 전달하도록 수정 가능
  const roomPlayers: Record<string, any> = {};
  for(const pid in players) {
    if(players[pid].room === DEFAULT_ROOM) {
        roomPlayers[pid] = players[pid];
    }
  }
  socket.emit('current_players', roomPlayers);

  // 위치 이동 시 상태 업데이트 (상태 동기화 모델)
  socket.on('MOVE', (data) => {
    if (players[socket.id]) {
      // 서버 권한(Server Authoritative)이므로 여기선 클라이언트 값 검증을 추가해야 하나, 데모상 그대로 수용
      players[socket.id].position = data.position;
      if (data.quaternion) {
        players[socket.id].quaternion = data.quaternion;
      }
      
      // 같은 방의 모든 클라이언트에게 변경된 위치/회전값 브로드캐스팅
      socket.to(players[socket.id].room).emit('STATE_UPDATE', {
        id: socket.id,
        position: data.position,
        quaternion: data.quaternion,
        upperYaw: data.upperYaw
      });
    }
  });

  // 데미지 처리 이벤트
  socket.on('TAKE_DAMAGE', (data: { targetId: string, damage: number, shooterId: string, direction: {x: number, y: number, z: number} }) => {
    const target = players[data.targetId];
    if (target && target.hp > 0) {
      target.hp -= data.damage;
      const room = target.room || DEFAULT_ROOM;

      // 데미지 발생 알림 브로드캐스트
      io.to(room).emit('PLAYER_DAMAGED', {
        targetId: data.targetId,
        hp: target.hp,
        shooterId: data.shooterId,
        direction: data.direction
      });

      // 사망 처리 (자동 리스폰 제거, 0으로 고정)
      if (target.hp <= 0) {
        target.hp = 0;
        // 클라이언트에서 움직임 제한을 위해 0으로 전송
        io.to(room).emit('PLAYER_DAMAGED', {
          targetId: data.targetId,
          hp: 0,
          shooterId: data.shooterId,
          direction: data.direction
        });
      }
    }
  });

  // 채팅 메시지 수신 및 전달
  socket.on('CHAT_MESSAGE', (data: { text: string }) => {
    socket.to(players[socket.id]?.room || DEFAULT_ROOM).emit('CHAT_MESSAGE', {
        sender: players[socket.id]?.name || '익명',
        text: data.text
    });
  });

  // 탄환 발사 이벤트 중계 (같은 방 플레이어들에게만 전달)
  socket.on('SHOOT', (data: {
    origin: { x: number, y: number, z: number };
    direction: { x: number, y: number, z: number };
  }) => {
    const room = players[socket.id]?.room || DEFAULT_ROOM;
    socket.to(room).emit('SHOOT', {
      id: socket.id,
      origin: data.origin,
      direction: data.direction,
    });
  });

  socket.on('disconnect', () => {
    console.log(`플레이어 접속 해제: ${socket.id}`);
    const leftPlayerRoom = players[socket.id]?.room || DEFAULT_ROOM;
    delete players[socket.id];
    
    // 같은 방 안의 플레이어들에게만 접속 해제 알림
    io.to(leftPlayerRoom).emit('player_left', socket.id);
  });
});

// ─── 주기적으로 플레이어 간 거리 체크 및 HP 회복 (1초 간격) ──────────
setInterval(() => {
  const playerIds = Object.keys(players);
  for (const id1 of playerIds) {
    const p1 = players[id1];
    if (!p1 || p1.hp >= 100) continue;

    let hasHealer = false;
    for (const id2 of playerIds) {
      if (id1 === id2) continue;
      const p2 = players[id2];
      if (!p2) continue;
      
      const dx = p1.position.x - p2.position.x;
      const dy = p1.position.y - p2.position.y;
      const dz = p1.position.z - p2.position.z;
      const distSq = dx*dx + dy*dy + dz*dz;

      if (distSq < 2.5 * 2.5) { // 약 2.5유닛 이내면 회복
        hasHealer = true;
        break;
      }
    }

    if (hasHealer) {
      p1.hp = Math.min(100, p1.hp + 10);
      io.to(p1.room).emit('PLAYER_DAMAGED', {
        targetId: p1.id,
        hp: p1.hp,
        shooterId: 'system_heal',
        direction: { x: 0, y: 0, z: 0 }
      });
    }
  }
}, 1000);

server.listen(PORT, () => {
  console.log(`🚀 웹소켓 게임 서버 가동 중 (포트 ${PORT})...`);
});
