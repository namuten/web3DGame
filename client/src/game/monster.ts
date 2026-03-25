import * as THREE from 'three';
import { scene } from '../engine/scene';
import { getGroundHeight } from './world';

export interface MonsterData {
    id: string;
    position: { x: number; y: number; z: number };
}

function createKoreanLetterMesh() {
    const chars = [
        "가","나","다","라","마","바","사","아","자","차","카","타","파","하",
        "거","너","더","러","머","버","서","어","저","처","커","터","퍼","허",
        "왕","슬","라","임","똥","별","달","돈","힘","꿈","빛","콩","팡","쾅",
        "퓩","뽕","쓩","앗","잉","헉","얍","읏","멍","냥","꿀","빔","빵","뿅"
    ];
    const text = chars[Math.floor(Math.random() * chars.length)];
    
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
    ctx.strokeText(text, 64, 64);
    
    // Draw text
    ctx.fillStyle = '#FFD700'; // Gold
    ctx.fillText(text, 64, 64);
    
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

        // 3. 내부 글자 메쉬 2개 추가
        this.innerChars = [];
        for (let i = 0; i < 2; i++) {
            const mesh = createKoreanLetterMesh();
            // 약간 작게 조절 (둘이 너무 꽉 차지 않게)
            mesh.scale.set(0.8, 0.8, 0.8);
            group.add(mesh);
            this.innerChars.push({
                mesh,
                pos: new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4),
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

        // 내부 한글 물리 엔진 보정
        if (this.innerChars.length > 0 && deltaTime > 0.001) {
            const worldVel = new THREE.Vector3().subVectors(currentRealPos, this.previousMonsterPos).divideScalar(deltaTime);
            const worldAccel = new THREE.Vector3().subVectors(worldVel, this.previousWorldVel).divideScalar(deltaTime);
            
            worldAccel.clampLength(0, 1000);
            const inertiaForce = worldAccel.multiplyScalar(-1.5);
            
            for (const char of this.innerChars) {
                // 스프링 힘 (다시 중앙으로 돌아오려는 성질)
                const springForce = char.pos.clone().multiplyScalar(-60);
                
                // 댐핑 반작용
                const dampingForce = char.vel.clone().multiplyScalar(-3);
                
                const totalForce = new THREE.Vector3().add(inertiaForce).add(springForce).add(dampingForce);
                
                char.vel.add(totalForce.multiplyScalar(deltaTime));
                char.pos.add(char.vel.clone().multiplyScalar(deltaTime));
                
                // 공 밖으로 너무 튀어나가지 않게 (반경 6.5)
                if (char.pos.length() > 6.5) {
                    char.pos.setLength(6.5);
                    char.vel.multiplyScalar(-0.5); // 벽에 부딪히면 튕김
                }
            }
            
            // 두 글자 간의 충돌 연산 (Elastic Collision)
            const c1 = this.innerChars[0];
            const c2 = this.innerChars[1];
            const collisionRadius = 3.5; 
            const diff = new THREE.Vector3().subVectors(c1.pos, c2.pos);
            const dist = diff.length();
            if (dist > 0 && dist < collisionRadius * 2) {
                // 겹친 만큼 밀어내기
                const overlap = collisionRadius * 2 - dist;
                const push = diff.clone().normalize().multiplyScalar(overlap * 0.5);
                c1.pos.add(push);
                c2.pos.sub(push);
                
                // 속도 교환 (탄성 충돌 효과 및 감쇠)
                const tempVel = c1.vel.clone();
                c1.vel.copy(c2.vel).multiplyScalar(0.8);
                c2.vel.copy(tempVel).multiplyScalar(0.8);
                
                // 강하게 부딪히면 추가 스핀 발생
                c1.rotVel.add(new THREE.Vector3((Math.random()-0.5)*50, (Math.random()-0.5)*50, (Math.random()-0.5)*50));
                c2.rotVel.add(new THREE.Vector3((Math.random()-0.5)*50, (Math.random()-0.5)*50, (Math.random()-0.5)*50));
            }

            for (const char of this.innerChars) {
                char.mesh.position.copy(char.pos);
                
                // 회전 물리 연산
                const randomTorque = new THREE.Vector3(
                    (Math.random() - 0.5) * 80,
                    (Math.random() - 0.5) * 80,
                    (Math.random() - 0.5) * 80
                ).multiplyScalar(deltaTime);

                char.rotVel.add(char.vel.clone().multiplyScalar(deltaTime * 10.0));
                char.rotVel.add(randomTorque);
                char.rotVel.multiplyScalar(0.99);
                
                char.rot.x += char.rotVel.x * deltaTime;
                char.rot.y += char.rotVel.y * deltaTime;
                char.rot.z += char.rotVel.z * deltaTime;
                char.mesh.rotation.copy(char.rot);
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
