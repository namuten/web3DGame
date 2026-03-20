import { pool } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export interface Character {
  _id: string;
  name: string;
  description?: string;
  bodyColor: string;
  flowerColor: string;
  visorColor: string;
  flowerType: string;
  createdAt?: Date;
}

/** 테이블이 없으면 자동 생성 */
export const ensureTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS characters (
      id          VARCHAR(36)   NOT NULL PRIMARY KEY,
      name        VARCHAR(20)   NOT NULL,
      description VARCHAR(100),
      bodyColor   VARCHAR(7)    NOT NULL,
      flowerColor VARCHAR(7)    NOT NULL,
      visorColor  VARCHAR(7)    NOT NULL,
      flowerType  VARCHAR(20)   NOT NULL DEFAULT 'daisy',
      createdAt   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
};

const rowToChar = (row: any): Character => ({
  _id:         row.id,
  name:        row.name,
  description: row.description ?? undefined,
  bodyColor:   row.bodyColor,
  flowerColor: row.flowerColor,
  visorColor:  row.visorColor,
  flowerType:  row.flowerType,
  createdAt:   row.createdAt,
});

export const findAll = async (): Promise<Character[]> => {
  const [rows] = await pool.execute('SELECT * FROM characters ORDER BY createdAt DESC');
  return (rows as any[]).map(rowToChar);
};

export const findById = async (id: string): Promise<Character | null> => {
  const [rows] = await pool.execute('SELECT * FROM characters WHERE id = ?', [id]);
  const list = rows as any[];
  return list.length ? rowToChar(list[0]!) : null;
};

export const create = async (data: Omit<Character, '_id' | 'createdAt'>): Promise<Character> => {
  const id = uuidv4();
  await pool.execute(
    'INSERT INTO characters (id, name, description, bodyColor, flowerColor, visorColor, flowerType) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, data.name, data.description ?? null, data.bodyColor, data.flowerColor, data.visorColor, data.flowerType]
  );
  return (await findById(id))!;
};

export const update = async (
  id: string,
  data: Partial<Omit<Character, '_id' | 'createdAt'>>
): Promise<Character | null> => {
  const fields = Object.keys(data) as (keyof typeof data)[];
  if (!fields.length) return findById(id);
  const set = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (data as any)[f]);
  await pool.execute(`UPDATE characters SET ${set} WHERE id = ?`, [...values, id]);
  return findById(id);
};

export const remove = async (id: string): Promise<boolean> => {
  const [result] = await pool.execute('DELETE FROM characters WHERE id = ?', [id]);
  return (result as any).affectedRows > 0;
};
