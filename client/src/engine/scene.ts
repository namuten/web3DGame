import * as THREE from 'three';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // 하늘색 배경
scene.fog = new THREE.Fog(0x87ceeb, 10, 50);
