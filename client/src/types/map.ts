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
  bgmFile?: string;     // 맵별 BGM 파일명 (확장자 제외, public/sounds/bgm/ 기준)
}
