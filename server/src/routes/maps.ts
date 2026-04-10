import { Router } from 'express';
import type { Request, Response } from 'express';
import * as MapModel from '../models/Map.js';

const router = Router();

// 활성 맵 목록 (게임 로비용)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const maps = await MapModel.findAllActive();
    res.json(maps);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch maps', message: err.message });
  }
});

// 전체 맵 목록 (어드민용)
router.get('/all', async (_req: Request, res: Response) => {
  try {
    const maps = await MapModel.findAll();
    res.json(maps);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch maps', message: err.message });
  }
});

// 단일 조회
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const map = await MapModel.findById(id);
    if (!map) return res.status(404).json({ error: 'Not found' });
    res.json(map);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch map', message: err.message });
  }
});

// 생성
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, theme, floorSize, playZone, obstacleCount,
      obstacleColors, fogDensity, bgColor, seed, isActive, bgmFile, monsterId } = req.body;


    if (!name || !theme) {
      return res.status(400).json({ error: 'name and theme are required' });
    }
    if (!Array.isArray(obstacleColors) || obstacleColors.length === 0) {
      return res.status(400).json({ error: 'obstacleColors must be a non-empty array' });
    }
    if (seed !== undefined && (seed < 0 || seed > 2147483647)) {
      return res.status(400).json({ error: 'seed must be 0 ~ 2147483647' });
    }
    if (fogDensity !== undefined && (fogDensity < 0.001 || fogDensity > 0.05)) {
      return res.status(400).json({ error: 'fogDensity must be 0.001 ~ 0.05' });
    }

    // 바닥 크기 및 플레이 존 검증
    const fSize = Number(floorSize ?? 400);
    const pZone = Number(playZone ?? 80);

    if (fSize < 100 || fSize > 2000) {
      return res.status(400).json({ error: 'floorSize must be between 100 and 2000' });
    }
    // 장애물이 바닥 끝에 걸치지 않도록 약간의 여유(10유닛)를 둠
    if (pZone > (fSize / 2) - 10) {
      return res.status(400).json({ error: 'playZone must be less than (floorSize / 2) - 10' });
    }

    const map = await MapModel.create({
      name,
      theme,
      floorSize: fSize,
      playZone: pZone,
      obstacleCount: Number(obstacleCount ?? 80),
      obstacleColors,
      fogDensity: Number(fogDensity ?? 0.005),
      bgColor: bgColor ?? '#A2D2FF',
      seed: Number(seed ?? 42),
      isActive: isActive ?? true,
      bgmFile: bgmFile ?? undefined,
      monsterId: monsterId !== undefined ? Number(monsterId) : undefined,
    });

    res.status(201).json(map);
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to create map', message: err.message });
  }
});

// 수정
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { obstacleColors, seed, fogDensity } = req.body;

    // 수정 시에도 범위 검증 (값이 제공된 경우만)
    if (req.body.floorSize !== undefined) {
      const fSize = Number(req.body.floorSize);
      if (fSize < 100 || fSize > 2000) {
        return res.status(400).json({ error: 'floorSize must be between 100 and 2000' });
      }
    }

    const map = await MapModel.update(id, req.body);
    if (!map) return res.status(404).json({ error: 'Not found' });
    res.json(map);
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to update map', message: err.message });
  }
});

// 소프트 삭제 (is_active = false)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const ok = await MapModel.deactivate(id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deactivated' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to deactivate map', message: err.message });
  }
});

export default router;
