const API_URL = import.meta.env.VITE_API_URL || 'https://namuten.duckdns.org';
const BASE = `${API_URL}/api/maps`;

export interface MapData {
  id?: number;
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
}

export const fetchMaps = async (): Promise<MapData[]> => {
  const res = await fetch(`${BASE}/all`);
  if (!res.ok) throw new Error('Failed to fetch maps');
  return res.json();
};

export const fetchMap = async (id: number): Promise<MapData> => {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error('Not found');
  return res.json();
};

export const createMap = async (data: Omit<MapData, 'id'>): Promise<MapData> => {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const updateMap = async (id: number, data: Partial<MapData>): Promise<MapData> => {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const deleteMap = async (id: number): Promise<void> => {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to deactivate');
};
