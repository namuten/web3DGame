import * as THREE from 'three';
import { scene } from '../engine/scene';
import { getGroundHeight } from './world';

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

function createKoreanLetterMesh(char: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(255, 255, 255, 0)';
    ctx.fillRect(0, 0, 128, 128);
    
    ctx.font = 'bold 80px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw outline
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#222222';
    ctx.strokeText(char, 64, 64);
    
    // Draw text
    ctx.fillStyle = '#FFD700'; // Gold
    ctx.fillText(char, 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    
    // 알파 테스트를 이용해 투명도를 자르고 여러 장 겹쳐서 두께(Depth)를 구현 (Fake 3D Extrusion)
    const material = new THREE.MeshStandardMaterial({ 
        map: texture, 
        transparent: true, 
        side: THREE.DoubleSide,
        alphaTest: 0.3 
    });
    const geo = new THREE.PlaneGeometry(7, 7);
    const group = new THREE.Group();
    
    // 20장을 겹쳐서 입체적인 두께 생성
    const layers = 20;
    const depth = 1.0; 
    for (let i = 0; i < layers; i++) {
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.z = (i - layers/2) * (depth / layers);
        group.add(mesh);
    }
    
    return group;
}

class MonsterManager {
    public monsterMesh: THREE.Group | null = null;
    private targetPos = new THREE.Vector3();
    private currentPos = new THREE.Vector3();
    private bodyMat: THREE.MeshStandardMaterial | null = null;
    private flashTimer = 0;
    private targetScale = 1.0;
    private currentScale = 1.0;

    private previousMonsterPos = new THREE.Vector3();
    private previousWorldVel = new THREE.Vector3();
    private innerChars: { mesh: THREE.Group, pos: THREE.Vector3, vel: THREE.Vector3, rot: THREE.Euler, rotVel: THREE.Vector3 }[] = [];

    private isMoving: boolean = false;
    private stopTimer: number = 0;
    private readonly MOVE_THRESHOLD = 2.0;   // 이 속도 이상이면 이동 상태
    private readonly STOP_DELAY = 0.5;       // 정지 전환 지연 (초)

    private _billboardWorldPos = new THREE.Vector3();
    private _billboardDummy = new THREE.Object3D();

    getIsMoving() {
        return this.isMoving;
    }

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
            emissiveIntensity: 0.5,
            depthWrite: false
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

        // 3. 내부 글자 메쉬 - DB 용어 글자 수에 맞게 동적 생성
        const FALLBACK_CHARS = [
            "가","나","다","라","마","바","사","아","자","차","카","타","파","하",
            "거","너","더","러","머","버","서","어","저","처","커","터","퍼","허",
            "왕","슬","라","임","똥","별","달","돈","힘","꿈","빛","콩","팡","쾅"
        ];
        let termChars: string[];
        if (data.term && data.term.length > 0) {
            const spread = [...data.term].slice(0, 10);
            termChars = spread;
        } else {
            termChars = Array.from({ length: 4 }, () =>
                FALLBACK_CHARS[Math.floor(Math.random() * FALLBACK_CHARS.length)]
            );
        }
        this.innerChars = [];
        for (const char of termChars) {
            const mesh = createKoreanLetterMesh(char);
            mesh.scale.set(0.65, 0.65, 0.65);
            group.add(mesh);
            this.innerChars.push({
                mesh,
                pos: new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6),
                vel: new THREE.Vector3(),
                rot: new THREE.Euler(),
                rotVel: new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10
                )
            });
        }

        // 초기 위치 강제 설정 (공중에 떠서 보이기 시작하게)
        group.position.set(data.position.x, 20, data.position.z);
        group.userData = { isMonster: true, monsterId: data.id };
        
        scene.add(group);
        this.monsterMesh = group;
        this.currentPos.copy(group.position);
        this.targetPos.copy(group.position);
        this.targetScale = 1.0;
        this.currentScale = 1.0;

        this.previousMonsterPos.copy(group.position);
        this.previousWorldVel.set(0,0,0);

        this.isMoving = false;
        this.stopTimer = 0;

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

    animate(time: number, deltaTime: number = 0.016, camera?: THREE.Camera) {
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
        
        // 지형 높이에 맞게 Y축 조정
        const groundY = getGroundHeight(this.currentPos.x, this.currentPos.z);
        
        // 부드러운 스케일 보간 (LERP)
        this.currentScale += (this.targetScale - this.currentScale) * 0.1;

        // 2. 꿀렁거리는 애니메이션 (Bouncing)
        const bounce = Math.abs(Math.sin(time * 3)) * 4 * this.currentScale;
        const scaleY = (1.0 - Math.abs(Math.sin(time * 3)) * 0.2) * this.currentScale;
        const scaleXZ = (1.0 + Math.abs(Math.sin(time * 3)) * 0.1) * this.currentScale;
        
        const currentRealPos = new THREE.Vector3(this.currentPos.x, groundY + 8 * this.currentScale + bounce, this.currentPos.z);
        this.monsterMesh.position.copy(currentRealPos);
        this.monsterMesh.scale.set(scaleXZ, scaleY, scaleXZ);

        // 내부 물체 물리 엔진 보정 (바구니 안의 물건처럼)
        if (this.innerChars.length > 0 && deltaTime > 0.001) {
            const worldVel = new THREE.Vector3().subVectors(currentRealPos, this.previousMonsterPos).divideScalar(deltaTime);

            // 이동/정지 상태 업데이트
            const speed = worldVel.length();
            if (speed > this.MOVE_THRESHOLD) {
                this.isMoving = true;
                this.stopTimer = this.STOP_DELAY; // 타이머 리셋
            } else {
                if (this.stopTimer > 0) {
                    this.stopTimer -= deltaTime;
                } else {
                    this.isMoving = false;
                }
            }

            const worldAccel = new THREE.Vector3().subVectors(worldVel, this.previousWorldVel).divideScalar(deltaTime);
            
            worldAccel.clampLength(0, 1000);
            const inertiaForce = worldAccel.clone().multiplyScalar(-2.5); // 관성력
            const gravityForce = new THREE.Vector3(0, -8, 0); // 중력을 절반으로 줄임
            const centeringForceMag = 5; // 중앙으로 살짝 띄워주는 힘 (부력 느낌)
            
            for (const char of this.innerChars) {
                // 댐핑 (마찰 및 저항)
                const dampingForce = char.vel.clone().multiplyScalar(-0.6);

                // 아래로 너무 가라앉지 않게 중앙으로 향하는 미세한 힘 추가
                const centeringForce = char.pos.clone().multiplyScalar(-centeringForceMag);

                const totalForce = new THREE.Vector3()
                    .add(gravityForce)
                    .add(dampingForce)
                    .add(centeringForce);

                if (this.isMoving) {
                    totalForce.add(inertiaForce);
                }

                char.vel.add(totalForce.multiplyScalar(deltaTime));

                if (this.isMoving) {
                    // 노이즈 킥: 공기가 계속 불어주는 느낌
                    char.vel.add(new THREE.Vector3(
                        (Math.random() - 0.5) * 15,
                        (Math.random() - 0.5) * 15,
                        (Math.random() - 0.5) * 15
                    ).multiplyScalar(deltaTime));

                    // 에너지 하한선: 절대 멈추지 않음
                    if (char.vel.length() < 3.0) {
                        char.vel.add(new THREE.Vector3(
                            (Math.random() - 0.5) * 5,
                            (Math.random() - 0.5) * 5,
                            (Math.random() - 0.5) * 5
                        ).multiplyScalar(deltaTime));
                    }
                }

                char.pos.add(char.vel.clone().multiplyScalar(deltaTime));
                
                // 공(슬라임) 안쪽 벽 충돌 처리 (반경 6.0)
                const maxRadius = 6.0;
                if (char.pos.length() > maxRadius) {
                    const normal = char.pos.clone().normalize();
                    // 벽 밖으로 나가지 않게 밀어넣음
                    char.pos.copy(normal.clone().multiplyScalar(maxRadius));
                    
                    // 반사 효과 (Bounce)
                    const dot = char.vel.dot(normal);
                    if (dot > 0) {
                        const restitution = 0.82; // 튐 정도
                        const bounceVel = normal.clone().multiplyScalar(dot * (1 + restitution));
                        char.vel.sub(bounceVel);
                        
                        // 벽에 부딪힐 때만 랜덤 회전 발생 (혼자서 도는 현상 방지)
                        char.rotVel.add(new THREE.Vector3(
                            (Math.random() - 0.5) * 10,
                            (Math.random() - 0.5) * 10,
                            (Math.random() - 0.5) * 10
                        ));
                    }
                }
            }
            
            // 글자 간의 충돌 연산 (N^2 지만 4개면 충분히 빠름)
            const collisionRadius = 2.8; 
            for (let i = 0; i < this.innerChars.length; i++) {
                for (let j = i + 1; j < this.innerChars.length; j++) {
                    const c1 = this.innerChars[i]!;
                    const c2 = this.innerChars[j]!;
                    const diff = new THREE.Vector3().subVectors(c1.pos, c2.pos);
                    const dist = diff.length();
                    if (dist > 0 && dist < collisionRadius * 2) {
                        const overlap = collisionRadius * 2 - dist;
                        const normal = diff.clone().normalize();
                        const push = normal.clone().multiplyScalar(overlap * 0.5);
                        c1.pos.add(push);
                        c2.pos.sub(push);
                        
                        const relVel = new THREE.Vector3().subVectors(c1.vel, c2.vel);
                        const velAlongNormal = relVel.dot(normal);
                        if (velAlongNormal < 0) {
                            const restitution = 0.82;
                            const impulse = normal.clone().multiplyScalar(velAlongNormal * (1 + restitution) * 0.5);
                            c1.vel.sub(impulse);
                            c2.vel.add(impulse);
                            
                            c1.rotVel.add(new THREE.Vector3((Math.random()-0.5)*15, (Math.random()-0.5)*15, (Math.random()-0.5)*15));
                            c2.rotVel.add(new THREE.Vector3((Math.random()-0.5)*15, (Math.random()-0.5)*15, (Math.random()-0.5)*15));
                        }
                    }
                }
            }

            for (const char of this.innerChars) {
                char.mesh.position.copy(char.pos);

                // 꾸준히 회전을 늦추어 바닥에 안착하면 자연스레 멈추게 함
                char.rotVel.multiplyScalar(this.isMoving ? 0.92 : 0.85);

                if (!this.isMoving && camera) {
                    // 정지 상태: 카메라를 향해 서서히 회전 (billboarding)
                    char.mesh.getWorldPosition(this._billboardWorldPos);
                    this._billboardDummy.position.copy(this._billboardWorldPos);
                    this._billboardDummy.lookAt(camera.position);
                    char.mesh.quaternion.slerp(this._billboardDummy.quaternion, 0.1);
                    // char.rot을 현재 quaternion과 동기화해 상태 전환 시 튀지 않게
                    char.rot.setFromQuaternion(char.mesh.quaternion);
                } else {
                    // 이동 상태: 자유 회전
                    char.rot.x += char.rotVel.x * deltaTime;
                    char.rot.y += char.rotVel.y * deltaTime;
                    char.rot.z += char.rotVel.z * deltaTime;
                    char.mesh.rotation.copy(char.rot);
                }
            }
            
            this.previousWorldVel.copy(worldVel);
        }
        
        this.previousMonsterPos.copy(currentRealPos);
    }

    remove() {
        if (this.monsterMesh) {
            scene.remove(this.monsterMesh);
            this.monsterMesh = null;
        }
    }
}

export const monsterManager = new MonsterManager();
