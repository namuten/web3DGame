import { pool } from '../db.js';

export interface GameMonster {
  id: number;
  name: string;
  glbFile: string;
  hp: number;
  speed: number;
  scale: number;
  moveSound?: string;
  attackSound?: string;
  isActive: boolean;
  createdAt?: Date;
}

/** 테이블이 없으면 자동 생성 */
export const ensureTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS monsters (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      name         VARCHAR(100) NOT NULL,
      glb_file     VARCHAR(200) NOT NULL,
      hp           INT          DEFAULT 100,
      speed        FLOAT        DEFAULT 3.0,
      scale        FLOAT        DEFAULT 1.0,
      move_sound   VARCHAR(200) DEFAULT NULL,
      attack_sound VARCHAR(200) DEFAULT NULL,
      is_active    BOOLEAN      DEFAULT TRUE,
      created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
};

const rowToMonster = (row: any): GameMonster => ({
  id: row.id,
  name: row.name,
  glbFile: row.glb_file,
  hp: row.hp,
  speed: row.speed,
  scale: row.scale,
  moveSound: row.move_sound ?? undefined,
  attackSound: row.attack_sound ?? undefined,
  isActive: Boolean(row.is_active),
  createdAt: row.created_at,
});

export const findAllActive = async (): Promise<GameMonster[]> => {
  const [rows] = await pool.execute(
    'SELECT * FROM monsters WHERE is_active = TRUE ORDER BY created_at ASC'
  );
  return (rows as any[]).map(rowToMonster);
};

export const findAll = async (): Promise<GameMonster[]> => {
  const [rows] = await pool.execute('SELECT * FROM monsters ORDER BY created_at ASC');
  return (rows as any[]).map(rowToMonster);
};

export const findById = async (id: number): Promise<GameMonster | null> => {
  const [rows] = await pool.execute('SELECT * FROM monsters WHERE id = ?', [id]);
  const list = rows as any[];
  return list.length ? rowToMonster(list[0]!) : null;
};

export const create = async (
  data: Omit<GameMonster, 'id' | 'createdAt'>
): Promise<GameMonster> => {
  const [result] = await pool.execute(
    `INSERT INTO monsters (name, glb_file, hp, speed, scale, move_sound, attack_sound, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name, data.glbFile, data.hp, data.speed, data.scale,
      data.moveSound ?? null, data.attackSound ?? null, data.isActive
    ]
  );
  const insertId = (result as any).insertId;
  return (await findById(insertId))!;
};

export const update = async (
  id: number,
  data: Partial<Omit<GameMonster, 'id' | 'createdAt'>>
): Promise<GameMonster | null> => {
  const colMap: Record<string, string> = {
    name: 'name', glbFile: 'glb_file', hp: 'hp',
    speed: 'speed', scale: 'scale', moveSound: 'move_sound',
    attackSound: 'attack_sound', isActive: 'is_active'
  };
  const fields = (Object.keys(data) as (keyof typeof data)[]).filter(f => colMap[f]);
  if (!fields.length) return findById(id);
  const set = fields.map(f => `${colMap[f]} = ?`).join(', ');

  const values = fields.map(f => (data as any)[f]);
  await pool.execute(`UPDATE monsters SET ${set} WHERE id = ?`, [...values, id]);
  return findById(id);
};

export const remove = async (id: number): Promise<boolean> => {
  const [result] = await pool.execute(
    'DELETE FROM monsters WHERE id = ?', [id]
  );
  return (result as any).affectedRows > 0;
};

