const API_URL = import.meta.env.VITE_API_URL || '';
const BASE = `${API_URL}/api/characters`;

export interface CharacterData {
  _id?: string;
  name: string;
  description?: string;
  bodyColor: string;
  flowerColor: string;
  visorColor: string;
  flowerType: string;
  visorType: string;
}

export const fetchCharacters = async (): Promise<CharacterData[]> => {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export const fetchCharacter = async (id: string): Promise<CharacterData> => {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error('Not found');
  return res.json();
};

export const createCharacter = async (data: Omit<CharacterData, '_id'>): Promise<CharacterData> => {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const updateCharacter = async (id: string, data: Partial<CharacterData>): Promise<CharacterData> => {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const deleteCharacter = async (id: string): Promise<void> => {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
};
