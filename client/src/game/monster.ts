import * as THREE from 'three';
import { scene } from '../engine/scene';
import { getGroundHeight } from './world';

export interface MonsterData {
    id: string;
    position: { x: number; y: number; z: number };
}

class MonsterManager {
    public monsterMesh: THREE.Group | null = null;
    private targetPos = new THREE.Vector3();
    private currentPos = new THREE.Vector3();
    private bodyMat: THREE.MeshStandardMaterial | null = null;
    private flashTimer = 0;
    private targetScale = 1.0;
    private currentScale = 1.0;

    spawn(data: MonsterData) {
        console.log(`[MonsterClientLog] Spawn Request Received:`, data);
        if (this.monsterMesh) this.remove();

        const group = new THREE.Group();
        
        // 1. 슬라임 몸체 (반투명 연두색)
        const bodyGeo = new THREE.SphereGeometry(8, 16, 16); 
        this.bodyMat = new THREE.MeshStandardMaterial({
            color: 0x00ff77,
            transparent: true,
            opacity: 0.7,
            roughness: 0.1,
            metalness: 0.2,
            emissive: 0x00ff77,
            emissiveIntensity: 0.5
        });
        const body = new THREE.Mesh(bodyGeo, this.bodyMat);
        body.castShadow = true;
        group.add(body);

        // 2. 눈
        const eyeGeo = new THREE.SphereGeometry(1, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(4, 3, 5);
        group.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(-4, 3, 5);
        group.add(rightEye);

        // 초기 위치 강제 설정 (공중에 떠서 보이기 시작하게)
        group.position.set(data.position.x, 20, data.position.z);
        group.userData = { isMonster: true, monsterId: data.id };
        
        scene.add(group);
        this.monsterMesh = group;
        this.currentPos.copy(group.position);
        this.targetPos.copy(group.position);
        this.targetScale = 1.0;
        this.currentScale = 1.0;

        const gy = getGroundHeight(data.position.x, data.position.z);
        console.log(`[MonsterClientLog] Spawned in Scene at:`, group.position, `GroundY:`, gy);
    }

    update(data: { position: { x: number, y: number, z: number } }) {
        if (!this.monsterMesh) return;
        this.targetPos.set(data.position.x, data.position.y, data.position.z);
    }

    damage(_hp: number, maxHp: number, scale: number = 1.0) {
        if (!this.monsterMesh || !this.bodyMat) return;
        this.flashTimer = 0.2; // 0.2초간 번쩍임
        console.log(`Monster HP: ${_hp}/${maxHp}, Scale: ${scale}`);
        this.targetScale = scale;
    }

    animate(time: number, deltaTime: number = 0.016) {
        if (!this.monsterMesh) return;

        // 1. 플래시 효과 (피격 시 빨간색)
        if (this.flashTimer > 0 && this.bodyMat) {
            this.flashTimer -= deltaTime;
            if (this.flashTimer > 0) {
                this.bodyMat.color.setHex(0xff0000);
                this.bodyMat.emissive.setHex(0xff0000);
            } else {
                this.bodyMat.color.setHex(0x00ff77);
                this.bodyMat.emissive.setHex(0x00ff77);
            }
        }

        // 2. 부드러운 위치 보간 (LERP)
        this.currentPos.lerp(this.targetPos, 0.1);
        
        // 지형 높이에 맞게 Y축 조정 (서버에서 Y=5 기본값이나, 클라에서 보정 가능)
        const groundY = getGroundHeight(this.currentPos.x, this.currentPos.z);
        
        // 부드러운 스케일 보간 (LERP)
        this.currentScale += (this.targetScale - this.currentScale) * 0.1;

        // 2. 꿀렁거리는 애니메이션 (Bouncing)
        const bounce = Math.abs(Math.sin(time * 3)) * 4 * this.currentScale;
        const scaleY = (1.0 - Math.abs(Math.sin(time * 3)) * 0.2) * this.currentScale;
        const scaleXZ = (1.0 + Math.abs(Math.sin(time * 3)) * 0.1) * this.currentScale;
        
        this.monsterMesh.position.set(this.currentPos.x, groundY + 8 * this.currentScale + bounce, this.currentPos.z);
        this.monsterMesh.scale.set(scaleXZ, scaleY, scaleXZ);
        
        // 플레이어 방향으로 살짝 회전 (나중에 리팩터링 가능)
    }

    remove() {
        if (this.monsterMesh) {
            scene.remove(this.monsterMesh);
            this.monsterMesh = null;
        }
    }
}

export const monsterManager = new MonsterManager();
