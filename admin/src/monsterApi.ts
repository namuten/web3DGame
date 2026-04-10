const API_URL = import.meta.env.VITE_API_URL || 'https://namuten.duckdns.org';
const BASE = `${API_URL}/api/monsters`;

export interface MonsterData {
  id?: number;
  name: string;
  glbFile: string;
  hp: number;
  speed: number;
  scale: number;
  moveSound?: string;
  attackSound?: string;
  isActive: boolean;
}

export const fetchMonsters = async (): Promise<MonsterData[]> => {
  const res = await fetch(`${BASE}/all`);
  if (!res.ok) throw new Error('Failed to fetch monsters');
  return res.json();
};

export const fetchMonster = async (id: number): Promise<MonsterData> => {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error('Not found');
  return res.json();
};

export const createMonster = async (data: Omit<MonsterData, 'id'>): Promise<MonsterData> => {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const updateMonster = async (id: number, data: Partial<MonsterData>): Promise<MonsterData> => {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const deleteMonster = async (id: number): Promise<void> => {
  const url = `${BASE}/${id}`;
  try {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[DeleteMonster] Failed: Status ${res.status}, Message: ${errorText}`);
      throw new Error(`Failed to delete: ${res.status}`);
    }
  } catch (err: any) {
    console.error(`[DeleteMonster] Network/Fetch Error:`, err);
    throw err;
  }
};


export const uploadMonsterFile = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BASE}/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('File upload failed');
  const data = await res.json();
  return data.filename;
};
