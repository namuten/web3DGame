import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

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

server.listen(PORT, () => {
  console.log(`🚀 웹소켓 게임 서버 가동 중 (포트 ${PORT})...`);
});
