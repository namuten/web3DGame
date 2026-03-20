import { Router } from 'express';
import type { Request, Response } from 'express';
import { Character } from '../models/Character.js';

const router = Router();

// 전체 목록
router.get('/', async (_req: Request, res: Response) => {
  try {
    const characters = await Character.find().sort({ createdAt: 1 });
    res.json(characters);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch characters' });
  }
});

// 단일 조회
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const character = await Character.findById(req.params.id);
    if (!character) return res.status(404).json({ error: 'Not found' });
    res.json(character);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch character' });
  }
});

// 생성
router.post('/', async (req: Request, res: Response) => {
  try {
    const character = new Character(req.body);
    await character.save();
    res.status(201).json(character);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 수정
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const character = await Character.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!character) return res.status(404).json({ error: 'Not found' });
    res.json(character);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 삭제
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const character = await Character.findByIdAndDelete(req.params.id);
    if (!character) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

export default router;
