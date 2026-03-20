import { Router } from 'express';
import type { Request, Response } from 'express';
import * as Character from '../models/Character.js';

const router = Router();

// 전체 목록
router.get('/', async (_req: Request, res: Response) => {
  try {
    const characters = await Character.findAll();
    res.json(characters);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch characters', message: err.message });
  }
});

// 단일 조회
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const character = await Character.findById(id);
    if (!character) return res.status(404).json({ error: 'Not found' });
    res.json(character);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch character', message: err.message });
  }
});

// 생성
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, bodyColor, flowerColor, visorColor, flowerType } = req.body;
    if (!name || !bodyColor || !flowerColor || !visorColor || !flowerType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const character = await Character.create({ name, description, bodyColor, flowerColor, visorColor, flowerType });
    res.status(201).json(character);
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to create', message: err.message });
  }
});

// 수정
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const character = await Character.update(id, req.body);
    if (!character) return res.status(404).json({ error: 'Not found' });
    res.json(character);
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to update', message: err.message });
  }
});

// 삭제
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const deleted = await Character.remove(id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete', message: err.message });
  }
});

export default router;
