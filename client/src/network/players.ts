import * as THREE from 'three';

// 다른 플레이어 메쉬들을 저장 (key=socketId, value=THREE.Group)
export const otherPlayers: Record<string, THREE.Group> = {};
