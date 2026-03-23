export interface MapConfig {
  id: number;
  name: string;
  theme: string;
  floorSize: number;
  playZone: number;      // 장애물 배치 반경 (±playZone 유닛)
  obstacleCount: number;
  obstacleColors: string[];
  fogDensity: number;
  bgColor: string;
  seed: number;
}
