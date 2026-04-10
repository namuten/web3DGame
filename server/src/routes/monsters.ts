import { Router } from 'express';
import type { Request, Response } from 'express';
import * as MonsterModel from '../models/Monster.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// 업로드 디렉토리 설정
const uploadDir = path.join(__dirname, '../../public/uploads/monsters');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer 설정
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.glb', '.mp3', '.ogg', '.wav'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .glb, .mp3, .ogg, .wav files are allowed'));
    }
  }
});

// 활성 몬스터 목록 (게임용)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const monsters = await MonsterModel.findAllActive();
    res.json(monsters);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch monsters', message: err.message });
  }
});

// 전체 몬스터 목록 (어드민용)
router.get('/all', async (_req: Request, res: Response) => {
  try {
    const monsters = await MonsterModel.findAll();
    res.json(monsters);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch monsters', message: err.message });
  }
});

// 단일 조회
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const monster = await MonsterModel.findById(id);
    if (!monster) return res.status(404).json({ error: 'Not found' });
    res.json(monster);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch monster', message: err.message });
  }
});

// 파일 업로드 API
router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ filename: req.file.filename });
  } catch (err: any) {
    res.status(500).json({ error: 'Upload failed', message: err.message });
  }
});

// 생성
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, glbFile, hp, speed, scale, moveSound, attackSound, isActive } = req.body;

    if (!name || !glbFile) {
      return res.status(400).json({ error: 'name and glbFile are required' });
    }

    const monster = await MonsterModel.create({
      name,
      glbFile,
      hp: Number(hp ?? 100),
      speed: Number(speed ?? 3.0),
      scale: Number(scale ?? 1.0),
      moveSound: moveSound || undefined,
      attackSound: attackSound || undefined,
      isActive: isActive ?? true,
    });
    res.status(201).json(monster);
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to create monster', message: err.message });
  }
});

// 수정
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const monster = await MonsterModel.update(id, req.body);
    if (!monster) return res.status(404).json({ error: 'Not found' });
    res.json(monster);
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to update monster', message: err.message });
  }
});

// 소프트 삭제
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    console.log(`[MonsterRoute] DELETE request for ID: ${id}`);
    const ok = await MonsterModel.remove(id);
    if (!ok) {
      console.warn(`[MonsterRoute] Monster not found for deletion: ID ${id}`);
      return res.status(404).json({ error: 'Not found' });
    }
    console.log(`[MonsterRoute] Successfully deleted monster: ID ${id}`);
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    console.error(`[MonsterRoute] Deletion error for ID ${req.params.id}:`, err);
    res.status(500).json({ error: 'Failed to delete monster', message: err.message });
  }
});


export default router;
