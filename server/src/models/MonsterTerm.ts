import { pool } from '../db.js';

export interface MonsterTerm {
  id: number;
  term: string;
  description: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const ensureTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS monster_terms (
      id          INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
      term        VARCHAR(20)   NOT NULL,
      description VARCHAR(200)  NOT NULL,
      createdAt   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updatedAt   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
};

const rowToTerm = (row: any): MonsterTerm => ({
  id:          row.id,
  term:        row.term,
  description: row.description,
  createdAt:   row.createdAt,
  updatedAt:   row.updatedAt,
});

export const findAll = async (): Promise<MonsterTerm[]> => {
  const [rows] = await pool.execute('SELECT * FROM monster_terms ORDER BY createdAt DESC');
  return (rows as any[]).map(rowToTerm);
};

export const findById = async (id: number): Promise<MonsterTerm | null> => {
  const [rows] = await pool.execute('SELECT * FROM monster_terms WHERE id = ?', [id]);
  const list = rows as any[];
  return list.length ? rowToTerm(list[0]!) : null;
};

export const findRandom = async (): Promise<MonsterTerm | null> => {
  const [rows] = await pool.execute('SELECT * FROM monster_terms ORDER BY RAND() LIMIT 1');
  const list = rows as any[];
  return list.length ? rowToTerm(list[0]!) : null;
};

export const create = async (data: Pick<MonsterTerm, 'term' | 'description'>): Promise<MonsterTerm> => {
  const [result] = await pool.execute(
    'INSERT INTO monster_terms (term, description) VALUES (?, ?)',
    [data.term, data.description]
  );
  const insertId = (result as any).insertId;
  return (await findById(insertId))!;
};

export const update = async (
  id: number,
  data: Partial<Pick<MonsterTerm, 'term' | 'description'>>
): Promise<MonsterTerm | null> => {
  const fields = Object.keys(data) as (keyof typeof data)[];
  if (!fields.length) return findById(id);
  const set = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (data as any)[f]);
  await pool.execute(`UPDATE monster_terms SET ${set} WHERE id = ?`, [...values, id]);
  return findById(id);
};

export const remove = async (id: number): Promise<boolean> => {
  const [result] = await pool.execute('DELETE FROM monster_terms WHERE id = ?', [id]);
  return (result as any).affectedRows > 0;
};
