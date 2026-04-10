import { pool } from '../db.js';

export interface GameMap {
  id: number;
  name: string;
  theme: string;
  floorSize: number;
  playZone: number;
  obstacleCount: number;
  obstacleColors: string[];
  fogDensity: number;
  bgColor: string;
  seed: number;
  isActive: boolean;
  bgmFile?: string;
  monsterId?: number;
  createdAt?: Date;
}


/** 테이블이 없으면 자동 생성 */
export const ensureTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS maps (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      name           VARCHAR(100) NOT NULL,
      theme          VARCHAR(50)  NOT NULL,
      floor_size     INT          DEFAULT 400,
      play_zone      INT          DEFAULT 80,
      obstacle_count INT          DEFAULT 80,
      obstacle_colors JSON        NOT NULL,
      fog_density    FLOAT        DEFAULT 0.005,
      bg_color       VARCHAR(7)   DEFAULT '#A2D2FF',
      seed           INT          DEFAULT 42,
      is_active      BOOLEAN      DEFAULT TRUE,
      bgm_file       VARCHAR(100) DEFAULT NULL,
      monster_id     INT          DEFAULT NULL,
      created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  // 기존 테이블에 monster_id 필드가 없는 경우 추가 (Migration)
  try {
    const [cols]: any = await pool.execute("SHOW COLUMNS FROM maps LIKE 'monster_id'");
    if (cols.length === 0) {
      await pool.execute("ALTER TABLE maps ADD COLUMN monster_id INT DEFAULT NULL AFTER bgm_file");
      console.log('✅ maps 테이블에 monster_id 컬럼 추가 완료');
    }
  } catch (err) {
    console.warn('⚠️ maps 테이블 monster_id 컬럼 확인 중 오류:', err);
  }
};


const rowToMap = (row: any): GameMap => ({
  id: row.id,
  name: row.name,
  theme: row.theme,
  floorSize: row.floor_size,
  playZone: row.play_zone,
  obstacleCount: row.obstacle_count,
  obstacleColors: typeof row.obstacle_colors === 'string'
    ? JSON.parse(row.obstacle_colors)
    : row.obstacle_colors,
  fogDensity: row.fog_density,
  bgColor: row.bg_color,
  seed: row.seed,
  isActive: Boolean(row.is_active),
  bgmFile: row.bgm_file ?? undefined,
  monsterId: row.monster_id ?? undefined,
  createdAt: row.created_at,
});


export const findAllActive = async (): Promise<GameMap[]> => {
  const [rows] = await pool.execute(
    'SELECT * FROM maps WHERE is_active = TRUE ORDER BY created_at ASC'
  );
  return (rows as any[]).map(rowToMap);
};

export const findAll = async (): Promise<GameMap[]> => {
  const [rows] = await pool.execute('SELECT * FROM maps ORDER BY created_at ASC');
  return (rows as any[]).map(rowToMap);
};

export const findById = async (id: number): Promise<GameMap | null> => {
  const [rows] = await pool.execute('SELECT * FROM maps WHERE id = ?', [id]);
  const list = rows as any[];
  return list.length ? rowToMap(list[0]!) : null;
};

export const create = async (
  data: Omit<GameMap, 'id' | 'createdAt'>
): Promise<GameMap> => {
  const [result] = await pool.execute(
    `INSERT INTO maps (name, theme, floor_size, play_zone, obstacle_count,
      obstacle_colors, fog_density, bg_color, seed, is_active, bgm_file, monster_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

    [
      data.name, data.theme, data.floorSize, data.playZone, data.obstacleCount,
      JSON.stringify(data.obstacleColors), data.fogDensity, data.bgColor,
      data.seed, data.isActive, data.bgmFile ?? null, data.monsterId ?? null
    ]

  );
  const insertId = (result as any).insertId;
  return (await findById(insertId))!;
};

export const update = async (
  id: number,
  data: Partial<Omit<GameMap, 'id' | 'createdAt'>>
): Promise<GameMap | null> => {
  const colMap: Record<string, string> = {
    name: 'name', theme: 'theme', floorSize: 'floor_size',
    playZone: 'play_zone', obstacleCount: 'obstacle_count',
    obstacleColors: 'obstacle_colors', fogDensity: 'fog_density',
    bgColor: 'bg_color', seed: 'seed', isActive: 'is_active',
    bgmFile: 'bgm_file', monsterId: 'monster_id',
  };

  const fields = (Object.keys(data) as (keyof typeof data)[]).filter(f => colMap[f]);
  if (!fields.length) return findById(id);
  const set = fields.map(f => `${colMap[f]} = ?`).join(', ');
  const values = fields.map(f =>
    f === 'obstacleColors'
      ? JSON.stringify((data as any)[f])
      : (data as any)[f]
  );
  await pool.execute(`UPDATE maps SET ${set} WHERE id = ?`, [...values, id]);
  return findById(id);
};

/** 소프트 삭제: is_active = false */
export const deactivate = async (id: number): Promise<boolean> => {
  const [result] = await pool.execute(
    'UPDATE maps SET is_active = FALSE WHERE id = ?', [id]
  );
  return (result as any).affectedRows > 0;
};
