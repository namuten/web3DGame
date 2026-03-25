import { Router } from 'express';
import type { Request, Response } from 'express';
import * as MonsterTerm from '../models/MonsterTerm.js';

const router = Router();

// 전체 목록
router.get('/', async (_req: Request, res: Response) => {
  try {
    const terms = await MonsterTerm.findAll();
    res.json(terms);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch terms', message: err.message });
  }
});

// 생성
router.post('/', async (req: Request, res: Response) => {
  try {
    const { term, description } = req.body;
    if (!term || typeof term !== 'string' || term.trim() === '') {
      return res.status(400).json({ error: 'term is required' });
    }
    if ([...term.trim()].length > 10) {
      return res.status(400).json({ error: 'term must be 10 characters or less' });
    }
    if (!description || typeof description !== 'string' || description.trim() === '') {
      return res.status(400).json({ error: 'description is required' });
    }
    if (description.trim().length > 200) {
      return res.status(400).json({ error: 'description must be 200 characters or less' });
    }
    const created = await MonsterTerm.create({ term: term.trim(), description: description.trim() });
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to create', message: err.message });
  }
});

// 수정
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { term, description } = req.body;
    const patch: Partial<Pick<any, 'term' | 'description'>> = {};
    if (term !== undefined) {
      if (typeof term !== 'string' || term.trim() === '') {
        return res.status(400).json({ error: 'term must be a non-empty string' });
      }
      if ([...term.trim()].length > 10) {
        return res.status(400).json({ error: 'term must be 10 characters or less' });
      }
      patch.term = term.trim();
    }
    if (description !== undefined) {
      if (typeof description !== 'string' || description.trim() === '') {
        return res.status(400).json({ error: 'description must be a non-empty string' });
      }
      if (description.trim().length > 200) {
        return res.status(400).json({ error: 'description must be 200 characters or less' });
      }
      patch.description = description.trim();
    }
    const updated = await MonsterTerm.update(id, patch);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to update', message: err.message });
  }
});

// 삭제
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const deleted = await MonsterTerm.remove(id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete', message: err.message });
  }
});

export default router;
