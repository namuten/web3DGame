const API_URL = import.meta.env.VITE_API_URL || '';
const BASE = `${API_URL}/api/monster-terms`;

export interface TermData {
  id?: number;
  term: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

export const fetchTerms = async (): Promise<TermData[]> => {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error('Failed to fetch terms');
  return res.json();
};

export const createTerm = async (data: Pick<TermData, 'term' | 'description'>): Promise<TermData> => {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const updateTerm = async (id: number, data: Partial<Pick<TermData, 'term' | 'description'>>): Promise<TermData> => {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const deleteTerm = async (id: number): Promise<void> => {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
};
