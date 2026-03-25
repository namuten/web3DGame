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
    private innerCharMesh: THREE.Group | null = null;
    private innerCharPos = new THREE.Vector3();
    private innerCharVel = new THREE.Vector3();
    private innerCharRot = new THREE.Euler();
    private innerCharRotVel = new THREE.Vector3();

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

        // 3. 내부 글자 메쉬 (3D 판넬)
        this.innerCharMesh = createKoreanLetterMesh();
        group.add(this.innerCharMesh);
        this.innerCharPos.set(0, 0, 0);
        this.innerCharVel.set(0, 0, 0);
        this.innerCharRot.set(0, 0, 0);
        this.innerCharRotVel.set(
            (Math.random() - 0.5) * 5, 
            (Math.random() - 0.5) * 5, 
            (Math.random() - 0.5) * 5
        );

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
        if (this.innerCharMesh && deltaTime > 0.001) {
            const worldVel = new THREE.Vector3().subVectors(currentRealPos, this.previousMonsterPos).divideScalar(deltaTime);
            const worldAccel = new THREE.Vector3().subVectors(worldVel, this.previousWorldVel).divideScalar(deltaTime);
            
            // F = m*a (가속도의 반대 방향으로 관성력이 작용)
            // 반응성을 높이기 위해 관성 계수를 약간 올림
            worldAccel.clampLength(0, 1000);
            const inertiaForce = worldAccel.multiplyScalar(-1.5);
            
            // 스프링 힘 (다시 중앙으로 돌아오려는 성질)
            // 힘을 낮춰서 바깥으로 더 멀리 나갈 수 있게 함
            const springForce = this.innerCharPos.clone().multiplyScalar(-60);
            
            // 댐핑 반작용 (꿀렁임이 더 오래 지속되도록 저항을 낮춤)
            const dampingForce = this.innerCharVel.clone().multiplyScalar(-3);
            
            const totalForce = new THREE.Vector3().add(inertiaForce).add(springForce).add(dampingForce);
            
            this.innerCharVel.add(totalForce.multiplyScalar(deltaTime));
            this.innerCharPos.add(this.innerCharVel.clone().multiplyScalar(deltaTime));
            
            // 공 밖으로 너무 튀어나가지 않게 (반경 6.5 로 여유범위 확대, 슬라임 크기는 8)
            if (this.innerCharPos.length() > 6.5) {
                this.innerCharPos.setLength(6.5);
            }
            
            this.innerCharMesh.position.copy(this.innerCharPos);
            
            // 회전 물리 연산: 극단적으로 회전을 많이, 어지럽게 하도록 강력한 랜덤 토크와 속도 반영
            const randomTorque = new THREE.Vector3(
                (Math.random() - 0.5) * 80,
                (Math.random() - 0.5) * 80,
                (Math.random() - 0.5) * 80
            ).multiplyScalar(deltaTime);

            this.innerCharRotVel.add(this.innerCharVel.clone().multiplyScalar(deltaTime * 10.0));
            this.innerCharRotVel.add(randomTorque);
            this.innerCharRotVel.multiplyScalar(0.99); // 거의 멈추지 않고 계속 빙글빙글 돌도록 댐핑 최소화
            
            this.innerCharRot.x += this.innerCharRotVel.x * deltaTime;
            this.innerCharRot.y += this.innerCharRotVel.y * deltaTime;
            this.innerCharRot.z += this.innerCharRotVel.z * deltaTime;
            this.innerCharMesh.rotation.copy(this.innerCharRot);
            
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
