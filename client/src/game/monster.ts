import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { scene } from '../engine/scene';
import { getGroundHeight } from './world';
import { soundManager } from '../audio/soundManager';

export interface MonsterData {
    id: string;
    mapId?: string;
    position: { x: number; y: number; z: number };
    targetId?: string | null;
    speed?: number;
    alive?: boolean;
    hp?: number;
    maxHp?: number;
    scale?: number;
    term?: string;
    termDesc?: string;
}


class MonsterManager {
    public monsterMesh: THREE.Group | null = null;
    private mixer: THREE.AnimationMixer | null = null;
    private animations: Map<string, THREE.AnimationAction> = new Map();

    private targetPos = new THREE.Vector3();
    private currentPos = new THREE.Vector3();
    private materials: THREE.MeshStandardMaterial[] = [];
    private flashTimer = 0;
    private targetScale = 1.0;
    private currentScale = 1.0;

    private previousMonsterPos = new THREE.Vector3();
    private previousWorldVel = new THREE.Vector3();

    private isMoving: boolean = false;
    private stopTimer: number = 0;
    private readonly MOVE_THRESHOLD = 2.0;
    private readonly STOP_DELAY = 0.5;

    private facingAngle = 0;
    private currentVisualY = 0;

    getIsMoving() {
        return this.isMoving;
    }

    spawn(data: MonsterData) {
        console.log(`[MonsterClientLog] Spawn GLTF Request Received:`, data);
        if (this.monsterMesh) this.remove();

        const loader = new GLTFLoader();
        loader.load('/assets/monsters/monster.glb', (gltf) => {
            const group = gltf.scene;

            // 스케일/위치 조정
            group.scale.setScalar(0.1); 
            const groundY = getGroundHeight(data.position.x, data.position.z);
            group.position.set(data.position.x, groundY, data.position.z);

            // AnimationMixer 설정
            this.mixer = new THREE.AnimationMixer(group);
            console.log(`[MonsterAnimations] Clips found:`, gltf.animations.map(c => c.name));
            gltf.animations.forEach(clip => {
                // Root Motion을 프로그램적으로 제거: 수평 이동 트랙 필터링
                clip.tracks = clip.tracks.filter(track => {
                    const name = track.name.toLowerCase();
                    const isRootPos = name.includes('.position') && 
                                     (name.includes('hips') || name.includes('root') || name.includes('pelvis') || name.includes('scene'));
                    return !isRootPos; // 루트 이동 트랙은 제거 (제자리걸음 유도)
                });

                const action = this.mixer!.clipAction(clip);
                action.setEffectiveTimeScale(0.3); // 애니메이션 속도를 0.3배로 더 늦춤
                this.animations.set(clip.name, action);
            });

            // idle 애니메이션 재생
            const idleAction = this.animations.get('Idle') || 
                               this.animations.get('idle') || 
                               this.animations.get('mixamo.com') || 
                               this.animations.get('mixamo.com|Layer0');
            if (idleAction) {
                console.log(`[MonsterClientLog] Playing initial animation: ${idleAction.getClip().name}`);
                idleAction.play();
            }

            // 재질 수집 및 불필요한 메쉬(하얀 박스 등) 숨기기
            this.materials = [];
            group.traverse((child) => {
                const mesh = child as any;
                if (mesh.isMesh) {
                    const name = (mesh.name || '').toLowerCase();
                    // SkinnedMesh가 아니면서 이름에 box, cube, collision 등이 포함된 경우 숨김
                    if (!mesh.isSkinnedMesh && (name.includes('box') || name.includes('cube') || name.includes('collision') || name.includes('collider'))) {
                        mesh.visible = false;
                        return;
                    }

                    mesh.frustumCulled = false; // BoundingBox로 인한 사라짐 방지
                    const mat = mesh.material as THREE.MeshStandardMaterial;
                    if (Array.isArray(mesh.material)) {
                        this.materials.push(...(mesh.material as THREE.MeshStandardMaterial[]));
                    } else {
                        this.materials.push(mat);
                    }
                }
            });

            group.userData = { isMonster: true, monsterId: data.id };
            scene.add(group);
            this.monsterMesh = group;

            this.currentPos.copy(group.position);
            this.targetPos.copy(group.position);
            this.currentVisualY = groundY + 9.2;
            this.targetScale = 1.0;
            this.currentScale = 1.0;
            this.facingAngle = 0;

            this.previousMonsterPos.copy(group.position);
            this.previousWorldVel.set(0, 0, 0);
            this.isMoving = false;
            this.stopTimer = 0;

            console.log(`[MonsterClientLog] Spawned GLTF in Scene at:`, group.position, `GroundY:`, groundY);
        }, undefined, (err) => {
            console.error(`[MonsterClientLog] Failed to load monster GLB!`, err);
        });
    }

    update(data: { position: { x: number, y: number, z: number } }) {
        if (!this.monsterMesh) return;
        this.targetPos.set(data.position.x, data.position.y, data.position.z);
    }

    damage(_hp: number, maxHp: number, scale: number = 1.0) {
        if (!this.monsterMesh) return;
        if (_hp <= 0) {
            soundManager.playDeath();
        } else {
            soundManager.playHit();
        }
        this.flashTimer = 0.2;
        console.log(`Monster HP: ${_hp}/${maxHp}, Scale: ${scale}`);
        this.targetScale = scale;
    }

    animate(time: number, deltaTime: number = 0.016, camera?: THREE.Camera) {
        if (!this.monsterMesh) return;

        // 1. 애니메이션 믹서 및 상태 전환
        this.mixer?.update(deltaTime);
        if (this.isMoving) {
            this.switchAnimation('Walk');
        } else {
            this.switchAnimation('Idle');
        }

        // Root Motion 방지: 그룹 내의 모든 자식과 루트 골격을 강제로 중앙(0, 0)에 고정
        this.monsterMesh.children.forEach(child => {
            child.position.x = 0;
            child.position.z = 0;
        });
        this.monsterMesh.traverse((child: any) => {
            if (child.isBone && (child.name.toLowerCase().includes('hips') || child.name.toLowerCase().includes('pelvis') || child.name.toLowerCase().includes('root'))) {
                child.position.x = 0;
                child.position.z = 0;
            }
        });

        // 2. 피격 플래시
        if (this.flashTimer > 0) {
            this.flashTimer -= deltaTime;
            const isFlashing = this.flashTimer > 0;
            this.materials.forEach(mat => {
                if (isFlashing) {
                    mat.emissive?.setHex(0xff2222);
                    mat.emissiveIntensity = 2.0;
                } else {
                    mat.emissive?.setHex(0x000000);
                    mat.emissiveIntensity = 0.1; // Restore base visibility
                }
            });
        }

        // 3. 위치/스케일 보간
        this.currentPos.lerp(this.targetPos, 0.12);
        const targetGroundY = getGroundHeight(this.currentPos.x, this.currentPos.z) + 9.2;
        this.currentVisualY = THREE.MathUtils.lerp(this.currentVisualY, targetGroundY, 0.15); // 높이 보간 추가
        this.currentScale += (this.targetScale - this.currentScale) * 0.1;

        // 4. 현재 실제 위치 계산
        const currentRealPos = new THREE.Vector3(
            this.currentPos.x,
            this.currentVisualY,
            this.currentPos.z
        );

        // 5. 월드 속도 계산 (이동/정지 판정)
        const worldVel = new THREE.Vector3()
            .subVectors(currentRealPos, this.previousMonsterPos)
            .divideScalar(deltaTime);
        const speed = worldVel.length();

        if (speed > this.MOVE_THRESHOLD) {
            this.isMoving = true;
            this.stopTimer = this.STOP_DELAY;
        } else {
            if (this.stopTimer > 0) this.stopTimer -= deltaTime;
            else this.isMoving = false;
        }

        // 6. 그룹 위치 및 균일 스케일 적용
        this.monsterMesh.position.copy(currentRealPos);
        this.monsterMesh.scale.setScalar(this.currentScale * 12.0);

        // 7. 이동 방향으로 부드럽게 회전
        if (this.isMoving) {
            const velXZ = new THREE.Vector2(worldVel.x, worldVel.z);
            if (velXZ.length() > 0.5) {
                const targetAngle = Math.atan2(velXZ.x, velXZ.y);
                let diff = targetAngle - this.facingAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                this.facingAngle += diff * 0.12;
                this.monsterMesh.rotation.y = this.facingAngle;
            }
        }

        this.previousMonsterPos.copy(currentRealPos);
        this.previousWorldVel.copy(worldVel);
    }

    switchAnimation(name: string) {
        let action = this.animations.get(name) || 
                       this.animations.get(name.toLowerCase()) || 
                       this.animations.get(name.charAt(0).toUpperCase() + name.slice(1).toLowerCase());

        // 현재 모델의 특이 케이스(클립이 하나뿐인 경우) 대응
        if (!action) action = this.animations.get('mixamo.com');

        if (!action) return;

        if (!action.isRunning()) {
            this.animations.forEach((a) => {
                if (a !== action) a.stop();
            });
            action.play();
        }
    }

    remove() {
        if (this.monsterMesh) {
            scene.remove(this.monsterMesh);
            this.monsterMesh = null;
            this.mixer = null;
            this.animations.clear();
            this.materials = [];
        }
    }
}

export const monsterManager = new MonsterManager();
