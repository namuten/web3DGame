import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { pool } from './db.js';
import { ensureTable as ensureCharacterTable } from './models/Character.js';
import { ensureTable as ensureMapTable } from './models/Map.js';
import characterRoutes from './routes/characters.js';
import mapRoutes from './routes/maps.js';
import * as MapModel from './models/Map.js';
import { ensureTable as ensureMonsterTermTable } from './models/MonsterTerm.js';
import * as MonsterTermModel from './models/MonsterTerm.js';
import monsterTermRoutes from './routes/monsterTerms.js';

const app = express();
app.use(cors());
app.use(express.json());

// MySQL 연결 확인 및 테이블 초기화
pool.getConnection()
  .then(async (conn) => {
    console.log('✅ MySQL 연결 성공');
    conn.release();
    await ensureCharacterTable();
    console.log('✅ characters 테이블 준비 완료');
    await ensureMapTable();
    console.log('✅ maps 테이블 준비 완료');
    await ensureMonsterTermTable();
    console.log('✅ monster_terms 테이블 준비 완료');
  })
  .catch((err: any) => console.error('❌ MySQL 연결 실패:', err));

// API 라우터
app.use('/api/characters', characterRoutes);
app.use('/api/maps', mapRoutes);
app.use('/api/monster-terms', monsterTermRoutes);

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

// ─── 몬스터(슬라임) 상태 관리 ──────────────────────────
const monsters: Record<string, any> = {}; // mapId -> Monster object
const spawnTimers: Record<string, NodeJS.Timeout> = {}; // mapId -> Timer

/** 맵별 접속자 수를 전체 소켓에 broadcast */
const broadcastMapPlayers = () => {
  const counts: Record<string, number> = {};
  for (const pid in players) {
    const mapId = players[pid].mapId;
    if (mapId) {
      counts[mapId] = (counts[mapId] || 0) + 1;
    }
  }
  io.emit('MAP_PLAYERS', counts);
};

io.on('connection', (socket: Socket) => {
  console.log(`플레이어 접속: ${socket.id}`);

  // 새로운 플레이어 생성 (캐릭터 선택 화면에서 전달된 데이터 사용)
  const auth = socket.handshake.auth as any;
  const playerName = String(auth?.playerName || '익명').slice(0, 12);

  players[socket.id] = {
    id:          socket.id,
    name:        playerName,
    mapId:       null,            // JOIN_MAP 전까지 null
    position:    { x: 0, y: 1, z: 0 },
    quaternion:  { _x: 0, _y: 0, _z: 0, _w: 1 },
    bodyColor:   auth?.bodyColor   ?? '#FFB7B2',
    flowerColor: auth?.flowerColor ?? '#FFB7B2',
    visorColor:  auth?.visorColor  ?? '#333333',
    flowerType:  auth?.flowerType  ?? 'daisy',
    visorType:   auth?.visorType   ?? 'normal',
    voiceId:     auth?.voiceId     ?? 'default',
    characterId: auth?.characterId ?? null,
    hp: 100,
  };

  // 로비에 있는 클라이언트들에게 맵별 접속자 수 전송
  broadcastMapPlayers();

  // ─── JOIN_MAP: 맵 선택 후 입장 ─────────────────────
  socket.on('JOIN_MAP', async (data: { mapId: any }) => {
    const mapId = Number(data.mapId);
    console.log(`[Socket] JOIN_MAP 요청: ID=${data.mapId} (Converted to: ${mapId})`);

    // DB에서 맵 설정 조회
    const mapConfig = await MapModel.findById(mapId);
    if (!mapConfig) {
      console.error(`[Socket] 맵을 찾을 수 없음: ID=${mapId}`);
      socket.emit('MAP_ERROR', { message: 'Map not found' });
      return;
    }

    console.log(`[Socket] 맵 발견: "${mapConfig.name}", 클라이언트에 MAP_CONFIG 전송`);
    const mapIdStr = String(mapConfig.id);

    // 기존 룸이 있다면 나가기 (안전장치)
    if (players[socket.id].mapId) {
        socket.leave(players[socket.id].mapId);
    }

    // 룸 입장
    socket.join(mapIdStr);
    players[socket.id].mapId = mapIdStr;

    // 1. MAP_CONFIG 먼저 전송
    socket.emit('MAP_CONFIG', mapConfig);

    // 2. 현재 맵의 플레이어 목록 전송
    const roomPlayers: Record<string, any> = {};
    for (const pid in players) {
      if (players[pid].mapId === mapIdStr) {
        roomPlayers[pid] = players[pid];
      }
    }
    socket.emit('current_players', roomPlayers);

    // 3. 같은 맵 다른 플레이어들에게 신규 입장 알림
    socket.to(mapIdStr).emit('player_joined', players[socket.id]);

    // 맵별 접속자 수 갱신 브로드캐스트
    broadcastMapPlayers();

    // 4. 슬라임 스폰 로직 (맵에 슬라임이 없고 타이머도 없을 때 소환 시도)
    const playersInMap = Object.values(players).filter(p => p.mapId === mapIdStr).length;
    socket.emit('CHAT_MESSAGE', { sender: 'SYSTEM_DEBUG', text: `[DEBUG] Map: ${mapIdStr}, Players: ${playersInMap}, MonsterExists: ${!!monsters[mapIdStr]}` });
    
    if (!monsters[mapIdStr] && !spawnTimers[mapIdStr]) {
      socket.emit('CHAT_MESSAGE', { sender: 'SYSTEM_DEBUG', text: `[DEBUG] Slime spawn timer started (5s)...` });
      spawnTimers[mapIdStr] = setTimeout(async () => {
        try {
          const config = mapConfig;
          const limit = config.playZone || 80;
          const termRecord = await MonsterTermModel.findRandom();
          const monster = {
            id: 'boss_slime',
            mapId: mapIdStr,
            position: {
              x: (Math.random() - 0.5) * limit * 0.8,
              y: 5,
              z: (Math.random() - 0.5) * limit * 0.8
            },
            targetId: null,
            speed: 0.45,
            alive: true,
            hp: 300,
            maxHp: 300,
            scale: 1.0,
            term: termRecord?.term,
            termDesc: termRecord?.description,
          };
          monsters[mapIdStr] = monster;
          io.to(mapIdStr).emit('MONSTER_SPAWN', monster);
          io.to(mapIdStr).emit('CHAT_MESSAGE', { sender: 'SYSTEM_DEBUG', text: `[DEBUG] Slime Spawned at X:${monster.position.x.toFixed(1)}, Z:${monster.position.z.toFixed(1)}` });
        } catch (err) {
          console.error('[SPAWN] Failed to spawn monster:', err);
        } finally {
          delete spawnTimers[mapIdStr];
        }
      }, 5000);
    } else if (monsters[mapIdStr]) {
      socket.emit('MONSTER_SPAWN', monsters[mapIdStr]);
      socket.emit('CHAT_MESSAGE', { sender: 'SYSTEM_DEBUG', text: `[DEBUG] Existing Slime found and sent to client.` });
    }

    console.log(`플레이어 ${socket.id} → 맵 ${mapIdStr} 입장`);
  });

  // 위치 이동 시 상태 업데이트 (상태 동기화 모델)
  socket.on('MOVE', (data) => {
    const player = players[socket.id];
    if (!player || !player.mapId) return;
    
    player.position = data.position;
    if (data.quaternion) {
      player.quaternion = data.quaternion;
    }
    
    // 해당 맵의 클라이언트에게만 브로드캐스팅
    socket.to(player.mapId).emit('STATE_UPDATE', {
      id: socket.id,
      position: data.position,
      quaternion: data.quaternion,
      upperYaw: data.upperYaw,
      upperPitch: data.upperPitch
    });
  });

  // 데미지 처리 이벤트
  socket.on('TAKE_DAMAGE', (data: { targetId: string, damage: number, shooterId: string, direction: {x: number, y: number, z: number} }) => {
    const player = players[socket.id];
    if (!player || !player.mapId) return;
    const room = player.mapId;

    if (data.targetId === 'boss_slime') {
      const monster = monsters[room];
      if (monster && monster.alive) {
        monster.hp -= data.damage;
        monster.scale = Math.max(0.15, monster.hp / monster.maxHp);

        if (monster.hp <= 0) {
          monster.hp = 0;
          monster.alive = false;
          io.to(room).emit('MONSTER_DEFEATED', { id: monster.id });
          delete monsters[room];
          io.to(room).emit('CHAT_MESSAGE', { sender: 'System', text: '보스 슬라임을 물리쳤습니다!' });
        } else {
          io.to(room).emit('MONSTER_DAMAGED', { id: monster.id, hp: monster.hp, maxHp: monster.maxHp, scale: monster.scale });
        }
      }
      return;
    }

    const target = players[data.targetId];
    if (target && target.hp > 0 && target.mapId === room) {
      target.hp -= data.damage;
      if (target.hp <= 0) target.hp = 0;

      // 데미지 발생 알림 브로드캐스트 (해당 룸에만)
      io.to(room).emit('PLAYER_DAMAGED', {
        targetId: data.targetId,
        hp: target.hp,
        shooterId: data.shooterId,
        direction: data.direction
      });
    }
  });

  // 채팅 메시지 수신 및 전달
  socket.on('CHAT_MESSAGE', (data: { text: string }) => {
    const player = players[socket.id];
    if (!player || !player.mapId) return;
    
    socket.to(player.mapId).emit('CHAT_MESSAGE', {
        sender: player.name || '익명',
        senderId: socket.id,
        text: data.text
    });
  });

  // 탄환 발사 이벤트 중계 (같은 맵 플레이어들에게만 전달)
  socket.on('SHOOT', (data: {
    origin: { x: number, y: number, z: number };
    direction: { x: number, y: number, z: number };
  }) => {
    const player = players[socket.id];
    if (!player || !player.mapId) return;
    
    socket.to(player.mapId).emit('SHOOT', {
      id: socket.id,
      origin: data.origin,
      direction: data.direction,
    });
  });

  socket.on('disconnect', () => {
    console.log(`플레이어 접속 해제: ${socket.id}`);
    const mapId = players[socket.id]?.mapId;
    if (mapId) {
      io.to(mapId).emit('player_left', socket.id);
      
      // 해당 맵에 아무도 없으면 몬스터 및 타이머 제거
      const remaining = Object.values(players).filter(p => (p.id !== socket.id) && (p.mapId === mapId)).length;
      if (remaining === 0) {
        if (spawnTimers[mapId]) {
          clearTimeout(spawnTimers[mapId]);
          delete spawnTimers[mapId];
        }
        delete monsters[mapId];
        console.log(`[Monster] 맵 ${mapId} 비어있음. 몬스터 제거.`);
      }
    }
    delete players[socket.id];
    broadcastMapPlayers();
  });
});

// ─── 몬스터 AI 및 충돌감지 루프 (약 100ms 마다) ─────────────
setInterval(() => {
  for (const mapId in monsters) {
    const monster = monsters[mapId];
    if (!monster || !monster.alive) continue;

    // 1. 타겟 또는 플레이어 추적
    const roomPlayers = Object.values(players).filter(p => p.mapId === mapId && p.hp > 0);
    if (roomPlayers.length === 0) {
      if (Object.values(players).filter(p => p.mapId === mapId).length > 0) {
          // 모든 플레이어가 죽음 -> 몬스터 승리
          io.to(mapId).emit('MONSTER_WIN', { message: 'The Boss Slime wins!' });
          monster.alive = false; // 한 번만 방송되도록
          setTimeout(() => { monster.alive = true; }, 5000); // 5초 뒤 다시 활동
      }
      continue;
    }

    // 가장 가까운 플레이어 찾기
    let target = null;
    let minDist = Infinity;
    for (const p of roomPlayers) {
      const dx = monster.position.x - p.position.x;
      const dz = monster.position.z - p.position.z;
      const d = dx*dx + dz*dz;
      if (d < minDist) {
        minDist = d;
        target = p;
      }
    }

    if (target) {
      // 플레이어 방향으로 이동 (스케일이 캐릭터 크기보다 작아지면(approx 0.3 미만) 이동 불가)
      const dx = target.position.x - monster.position.x;
      const dz = target.position.z - monster.position.z;
      const mag = Math.sqrt(dx*dx + dz*dz);
      const freezeThreshold = 0.3; // 캐릭터 크기 기준 임계값
      const scaleRadius = 5.0 * (monster.scale || 1.0);

      if (mag > 0.1 && (monster.scale === undefined || monster.scale > freezeThreshold)) {
        monster.position.x += (dx / mag) * monster.speed;
        monster.position.z += (dz / mag) * monster.speed;
      }

      // 충돌(Touch) 감지: 거리 = scaleRadius 유닛 미만 (스케일에 비례)
      if (mag < scaleRadius) {
        target.hp = 0;
        io.to(mapId).emit('PLAYER_DAMAGED', {
          targetId: target.id,
          hp: 0,
          shooterId: 'boss_slime',
          direction: { x: dx/mag, y: 0, z: dz/mag }
        });
        console.log(`[Monster] 슬라임이 ${target.id}를 처치함!`);

        // 캐릭터 처치 시 슬라임 체력 회복 및 크기 원상 복구 증가
        monster.hp = Math.min(monster.maxHp, monster.hp + 50);
        monster.scale = Math.max(0.15, monster.hp / monster.maxHp);
        io.to(mapId).emit('MONSTER_DAMAGED', { id: monster.id, hp: monster.hp, maxHp: monster.maxHp, scale: monster.scale });
      }
    }

    // 모든 플레이어에게 위치 전송
    io.to(mapId).emit('MONSTER_UPDATE', { 
        id: monster.id, 
        position: monster.position 
    });
  }
}, 100);

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

      if (distSq < 2.5 * 2.5 && p1.mapId === p2.mapId && p1.mapId) { // 동일 맵 내 약 2.5유닛 이내면 회복
        hasHealer = true;
        break;
      }
    }

    if (hasHealer) {
      p1.hp = Math.min(100, p1.hp + 10);
      io.to(p1.mapId).emit('PLAYER_DAMAGED', {
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
