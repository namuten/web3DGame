import * as THREE from 'three';
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

const GEM_COLORS = [0xaa44ff, 0xff8800, 0x00ccff, 0xff44aa, 0xffff44, 0x44ff88, 0xff4466, 0x4488ff];

// 노이즈 텍스처: 모듈 로드 시 1회만 생성 (spawn 때마다 재생성 방지)
function buildNoiseTexture(): THREE.Texture {
    const size = 128; // 256→128: 품질 차이 거의 없고 루프 4배 감소
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(size, size);
    const raw = new Float32Array(size * size);
    for (let k = 0; k < raw.length; k++) raw[k] = Math.random();
    // 3×3 blur (49→9 tap, 약 5배 빠름)
    for (let ny = 0; ny < size; ny++) {
        for (let nx = 0; nx < size; nx++) {
            let sum = 0;
            for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++)
                    sum += raw[((ny + dy + size) % size) * size + ((nx + dx + size) % size)]!;
            const v = sum / 9;
            const idx = (ny * size + nx) * 4;
            imgData.data[idx]     = Math.floor(128 + (v - 0.5) * 60);
            imgData.data[idx + 1] = Math.floor(128 + (v - 0.5) * 60);
            imgData.data[idx + 2] = 255;
            imgData.data[idx + 3] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}
const SHARED_NOISE_TEX = buildNoiseTexture(); // 앱 전체에서 1회 실행

function createGemLetterMesh(char: string, colorIndex: number) {
    const gemColor = GEM_COLORS[colorIndex % GEM_COLORS.length]!;
    const group = new THREE.Group();

    const gemGeo = new THREE.IcosahedronGeometry(1.8, 0);
    const gemMat = new THREE.MeshStandardMaterial({
        color: gemColor,
        emissive: gemColor,
        emissiveIntensity: 2.5,   // 🔥 강하게
        roughness: 0.05,
        metalness: 0.2,
        toneMapped: false,        // 🔥 색 죽는거 방지
    });
    const gem = new THREE.Mesh(gemGeo, gemMat);
    group.add(gem);

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 64);
    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(char, 32, 32);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(char, 32, 32);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const planeMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), planeMat);
    plane.position.z = 1.9;
    group.add(plane);

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
    private readonly MOVE_THRESHOLD = 2.0;
    private readonly STOP_DELAY = 0.5;
    private readonly BODY_COLOR = 0x5bc8d9;

    // 걷기 애니메이션용 파트 참조
    private leftLeg: THREE.Mesh | null = null;
    private rightLeg: THREE.Mesh | null = null;
    private leftArm: THREE.Mesh | null = null;
    private rightArm: THREE.Mesh | null = null;
    private facingAngle = 0;

    private _billboardWorldPos = new THREE.Vector3();
    private _billboardDummy = new THREE.Object3D();

    getIsMoving() {
        return this.isMoving;
    }

    spawn(data: MonsterData) {
        console.log(`[MonsterClientLog] Spawn Request Received:`, data);
        if (this.monsterMesh) this.remove();

        const group = new THREE.Group();

        // 공유 몸체 재질 - MeshPhysicalMaterial (유리/젤 투과 + Fresnel)
        // transmission은 씬을 2회 렌더링하므로 0.6으로 제한 (저사양 대응)
        this.bodyMat = new THREE.MeshPhysicalMaterial({
            color: this.BODY_COLOR,
            transparent: true,
            opacity: 0.85,
            transmission: 0.6,       // 0.92→0.6: 렌더 2회 비용 완화
            thickness: 2.0,
            roughness: 0.15,
            metalness: 0.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.15,
            ior: 1.33,
            depthWrite: true,
            normalMap: SHARED_NOISE_TEX,          // 1회 생성 재사용
            normalScale: new THREE.Vector2(0.12, 0.12),
        }) as unknown as THREE.MeshStandardMaterial;

        // Fresnel 효과 (가장자리 빛 반사)
        (this.bodyMat as any).onBeforeCompile = (shader: any) => {
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <output_fragment>',
                `
                float fresnel = pow(1.0 - dot(normalize(vViewPosition), normal), 3.0);
                gl_FragColor.rgb += fresnel * 0.6;
                #include <output_fragment>
                `
            );
        };

        const makePart = (geo: THREE.BufferGeometry, x: number, y: number, z: number): THREE.Mesh => {
            const mesh = new THREE.Mesh(geo, this.bodyMat!);
            mesh.castShadow = true;
            mesh.position.set(x, y, z);
            group.add(mesh);
            return mesh;
        };

        // 몸통
        makePart(new THREE.SphereGeometry(7, 32, 32), 0, 0, 0);
        // 머리
        makePart(new THREE.SphereGeometry(5.5, 32, 32), 0, 9, 0);
        // 팔
        this.leftArm  = makePart(new THREE.SphereGeometry(3.5, 16, 16), -10, 2, 0);
        this.rightArm = makePart(new THREE.SphereGeometry(3.5, 16, 16),  10, 2, 0);
        // 다리
        this.leftLeg  = makePart(new THREE.SphereGeometry(3, 16, 16), -4, -9, 0);
        this.rightLeg = makePart(new THREE.SphereGeometry(3, 16, 16),  4, -9, 0);

        // 눈 (발광 파란색)
        const eyeGlowMat = new THREE.MeshStandardMaterial({
            color: 0x88ddff, emissive: 0x44aaff, emissiveIntensity: 1.8, roughness: 0.0, metalness: 0.0,
        });
        const pupilMat = new THREE.MeshStandardMaterial({ color: 0x001133, roughness: 0.8 });

        const leftEyeGlow = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 12), eyeGlowMat);
        leftEyeGlow.position.set(2.2, 10.8, 4.8);
        group.add(leftEyeGlow);
        const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), pupilMat);
        leftPupil.position.set(2.5, 10.8, 5.8);
        group.add(leftPupil);

        const rightEyeGlow = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 12), eyeGlowMat);
        rightEyeGlow.position.set(-2.2, 10.8, 4.8);
        group.add(rightEyeGlow);
        const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), pupilMat);
        rightPupil.position.set(-2.5, 10.8, 5.8);
        group.add(rightPupil);

        // 웃는 입
        const smileCurve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(-2.2, 8.5, 5.0),
            new THREE.Vector3(0, 7.5, 5.3),
            new THREE.Vector3(2.2, 8.5, 5.0)
        );
        const smileGeo = new THREE.TubeGeometry(smileCurve, 12, 0.22, 6, false);
        group.add(new THREE.Mesh(smileGeo, new THREE.MeshStandardMaterial({ color: 0x112244 })));

        // 내부 보석 글자 메쉬
        const FALLBACK_CHARS = [
            "가","나","다","라","마","바","사","아","자","차","카","타","파","하",
            "거","너","더","러","머","버","서","어","저","처","커","터","퍼","허",
            "왕","슬","라","임","똥","별","달","돈","힘","꿈","빛","콩","팡","쾅"
        ];
        let termChars: string[];
        if (data.term && data.term.length > 0) {
            termChars = [...data.term].slice(0, 10);
        } else {
            termChars = Array.from({ length: 4 }, () =>
                FALLBACK_CHARS[Math.floor(Math.random() * FALLBACK_CHARS.length)]
            );
        }
        this.innerChars = [];
        for (let i = 0; i < termChars.length; i++) {
            const mesh = createGemLetterMesh(termChars[i]!, i);
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

        group.position.set(data.position.x, 20, data.position.z);
        group.userData = { isMonster: true, monsterId: data.id };

        scene.add(group);
        this.monsterMesh = group;
        this.currentPos.copy(group.position);
        this.targetPos.copy(group.position);
        this.targetScale = 1.0;
        this.currentScale = 1.0;
        this.facingAngle = 0;

        this.previousMonsterPos.copy(group.position);
        this.previousWorldVel.set(0, 0, 0);
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

        // 1. 피격 플래시
        if (this.flashTimer > 0 && this.bodyMat) {
            this.flashTimer -= deltaTime;
            if (this.flashTimer > 0) {
                this.bodyMat.color.setHex(0xff2222);
                this.bodyMat.emissive.setHex(0xff2222);
            } else {
                this.bodyMat.color.setHex(this.BODY_COLOR);
                this.bodyMat.emissive.setHex(this.BODY_COLOR);
            }
        }

        // 2. 위치/스케일 보간
        this.currentPos.lerp(this.targetPos, 0.1);
        const groundY = getGroundHeight(this.currentPos.x, this.currentPos.z);
        this.currentScale += (this.targetScale - this.currentScale) * 0.1;

        // 3. 현재 실제 위치 계산 (걷기 중 살짝 상하 bob)
        const WALK_SPEED = 4.5;
        const bodyBob = this.isMoving ? Math.abs(Math.sin(time * WALK_SPEED)) * 1.2 * this.currentScale : 0;
        const currentRealPos = new THREE.Vector3(
            this.currentPos.x,
            groundY + 9 * this.currentScale + bodyBob,
            this.currentPos.z
        );

        // 4. 월드 속도 계산 (이동/정지 판정)
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

        // 5. 그룹 위치 및 균일 스케일 적용 (squish 없음)
        this.monsterMesh.position.copy(currentRealPos);
        this.monsterMesh.scale.setScalar(this.currentScale);

        // 6. 걷기 애니메이션
        if (this.isMoving) {
            // 이동 방향으로 부드럽게 회전
            const velXZ = new THREE.Vector2(worldVel.x, worldVel.z);
            if (velXZ.length() > 1.0) {
                const targetAngle = Math.atan2(velXZ.x, velXZ.y);
                let diff = targetAngle - this.facingAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                this.facingAngle += diff * 0.12;
                this.monsterMesh.rotation.y = this.facingAngle;
            }

            // 다리 앞뒤 스윙
            const legPhase = Math.sin(time * WALK_SPEED);
            const legLift = 1.8; // 다리 들어올리는 높이
            const legSwingZ = 3.5; // 앞뒤 이동 거리

            if (this.leftLeg) {
                this.leftLeg.position.z = legPhase * legSwingZ;
                this.leftLeg.position.y = -9 + Math.max(0, legPhase) * legLift;
            }
            if (this.rightLeg) {
                this.rightLeg.position.z = -legPhase * legSwingZ;
                this.rightLeg.position.y = -9 + Math.max(0, -legPhase) * legLift;
            }

            // 팔 반대 방향 스윙 (자연스러운 걷기)
            if (this.leftArm)  this.leftArm.position.z  = -legPhase * 2.5;
            if (this.rightArm) this.rightArm.position.z =  legPhase * 2.5;

        } else {
            // 정지 시 파트 원래 위치로 복귀
            if (this.leftLeg) {
                this.leftLeg.position.z  *= 0.8;
                this.leftLeg.position.y  = THREE.MathUtils.lerp(this.leftLeg.position.y, -9, 0.15);
            }
            if (this.rightLeg) {
                this.rightLeg.position.z *= 0.8;
                this.rightLeg.position.y = THREE.MathUtils.lerp(this.rightLeg.position.y, -9, 0.15);
            }
            if (this.leftArm)  this.leftArm.position.z  *= 0.8;
            if (this.rightArm) this.rightArm.position.z *= 0.8;

            // 가만히 있을 때 살짝 숨쉬는 느낌 (아주 미세한 idle bob)
            const idleBob = Math.sin(time * 1.5) * 0.3;
            this.monsterMesh.position.y = currentRealPos.y + idleBob * this.currentScale;
        }

        // 7. 내부 보석 물리 시뮬레이션
        if (this.innerChars.length > 0 && deltaTime > 0.001) {
            const worldAccel = new THREE.Vector3().subVectors(worldVel, this.previousWorldVel).divideScalar(deltaTime);
            worldAccel.clampLength(0, 1000);
            const inertiaForce = worldAccel.clone().multiplyScalar(-2.5);
            const gravityForce = new THREE.Vector3(0, -8, 0);
            const centeringForceMag = 5;

            for (const char of this.innerChars) {
                const dampingForce = char.vel.clone().multiplyScalar(-0.6);
                const centeringForce = char.pos.clone().multiplyScalar(-centeringForceMag);

                const totalForce = new THREE.Vector3()
                    .add(gravityForce)
                    .add(dampingForce)
                    .add(centeringForce);

                if (this.isMoving) totalForce.add(inertiaForce);

                char.vel.add(totalForce.multiplyScalar(deltaTime));

                if (this.isMoving) {
                    char.vel.add(new THREE.Vector3(
                        (Math.random() - 0.5) * 15,
                        (Math.random() - 0.5) * 15,
                        (Math.random() - 0.5) * 15
                    ).multiplyScalar(deltaTime));

                    if (char.vel.length() < 3.0) {
                        char.vel.add(new THREE.Vector3(
                            (Math.random() - 0.5) * 5,
                            (Math.random() - 0.5) * 5,
                            (Math.random() - 0.5) * 5
                        ).multiplyScalar(deltaTime));
                    }
                }

                char.pos.add(char.vel.clone().multiplyScalar(deltaTime));

                const maxRadius = 6.0;
                if (char.pos.length() > maxRadius) {
                    const normal = char.pos.clone().normalize();
                    char.pos.copy(normal.clone().multiplyScalar(maxRadius));
                    const dot = char.vel.dot(normal);
                    if (dot > 0) {
                        const bounceVel = normal.clone().multiplyScalar(dot * 1.82);
                        char.vel.sub(bounceVel);
                        char.rotVel.add(new THREE.Vector3(
                            (Math.random() - 0.5) * 10,
                            (Math.random() - 0.5) * 10,
                            (Math.random() - 0.5) * 10
                        ));
                    }
                }
            }

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
                            const impulse = normal.clone().multiplyScalar(velAlongNormal * 0.91);
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
                char.rotVel.multiplyScalar(this.isMoving ? 0.92 : 0.85);

                if (!this.isMoving && camera) {
                    char.mesh.getWorldPosition(this._billboardWorldPos);
                    this._billboardDummy.position.copy(this._billboardWorldPos);
                    this._billboardDummy.lookAt(camera.position);
                    char.mesh.quaternion.slerp(this._billboardDummy.quaternion, 0.1);
                    char.rot.setFromQuaternion(char.mesh.quaternion);
                } else {
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
            this.leftLeg = null;
            this.rightLeg = null;
            this.leftArm = null;
            this.rightArm = null;
        }
    }
}

export const monsterManager = new MonsterManager();
