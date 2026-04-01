import * as THREE from 'three';
import { toThreeColor } from './utils';
import type { MapData } from './mapApi';

// ─── characterModel 복사 (admin 전용) ────────────────────────

const createFlowerModel = (flowerColor: number, flowerType: string = 'daisy') => {
  const flowerGroup = new THREE.Group();
  const stemSegments: THREE.Mesh[] = [];
  const stemPointCount = 8;
  const stemHeight = 1.2; // 줄기 길이 2배
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27 });

  for (let i = 0; i < stemPointCount; i++) {
    const t = i / (stemPointCount - 1);
    const segment = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, stemHeight / stemPointCount), stemMat);
    segment.position.set(0, t * stemHeight, 0);
    flowerGroup.add(segment);
    stemSegments.push(segment);
  }

  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.04), stemMat);
  leaf.scale.set(0.5, 1, 2);
  leaf.position.set(0, 0.2, 0.05);
  leaf.rotation.x = 0.5;
  flowerGroup.add(leaf);

  const flowerHead = new THREE.Group();
  flowerHead.position.set(0, stemHeight, 0);
  flowerHead.rotation.x = 0.4;
  flowerGroup.add(flowerHead);

  const center = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffcc00 }));
  const createPetalMat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.1, metalness: 0 });
  const initialPetalMat = createPetalMat(flowerColor);
  let petalMeshes: THREE.Mesh[] = [];

  if (flowerType === 'rose') {
    center.material = new THREE.MeshStandardMaterial({ color: 0x880000 });
    center.scale.set(1.25, 0.75, 1.25);
    flowerHead.add(center);
    const petalGeo = new THREE.SphereGeometry(0.08, 8, 8);
    petalGeo.scale(1.25, 1.75, 0.3);
    for (let i = 0; i < 18; i++) {
      const petal = new THREE.Mesh(petalGeo, initialPetalMat);
      const angle = (i / 18) * Math.PI * 2 * 2;
      const radius = 0.075 + (i * 0.0075);
      petal.position.set(Math.cos(angle) * radius, i * 0.01, Math.sin(angle) * radius);
      petal.rotation.y = -angle + Math.PI / 2;
      petal.rotation.x = -0.1 - (i * 0.02);
      flowerHead.add(petal);
      petalMeshes.push(petal);
    }
  } else if (flowerType === 'tulip') {
    center.visible = false;
    flowerHead.add(center);
    const petalGeo = new THREE.SphereGeometry(0.1, 8, 8);
    petalGeo.scale(1.1, 2.75, 0.3);
    for (let i = 0; i < 6; i++) {
      const petal = new THREE.Mesh(petalGeo, initialPetalMat);
      const angle = (i / 6) * Math.PI * 2;
      petal.position.set(Math.cos(angle) * 0.1, 0.15, Math.sin(angle) * 0.1);
      petal.rotation.y = -angle + Math.PI / 2;
      petal.rotation.x = 0.15;
      flowerHead.add(petal);
      petalMeshes.push(petal);
    }
  } else if (flowerType === 'sunflower') {
    center.geometry = new THREE.CylinderGeometry(0.18, 0.18, 0.03, 16) as any;
    center.material = new THREE.MeshStandardMaterial({ color: 0x3d2314 });
    center.rotation.x = Math.PI / 2;
    flowerHead.add(center);
    const petalGeo = new THREE.SphereGeometry(0.04, 8, 8);
    petalGeo.scale(1.75, 0.3, 4.75);
    for (let i = 0; i < 24; i++) {
      const petal = new THREE.Mesh(petalGeo, initialPetalMat);
      const angle = (i / 24) * Math.PI * 2;
      const radius = 0.225;
      petal.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      petal.rotation.y = -angle;
      flowerHead.add(petal);
      petalMeshes.push(petal);
    }
  } else if (flowerType === 'clover') {
    center.visible = false;
    flowerHead.add(center);
    const petalGeo = new THREE.SphereGeometry(0.12, 8, 8);
    petalGeo.scale(1.6, 0.25, 1.6);
    for (let i = 0; i < 4; i++) {
      const petal = new THREE.Mesh(petalGeo, initialPetalMat);
      const angle = (i / 4) * Math.PI * 2;
      petal.position.set(Math.cos(angle) * 0.175, 0, Math.sin(angle) * 0.175);
      petal.rotation.y = -angle;
      flowerHead.add(petal);
      petalMeshes.push(petal);
    }
  } else {
    // Daisy (default)
    center.scale.set(1.5, 0.6, 1.5);
    flowerHead.add(center);
    const petalGeo = new THREE.SphereGeometry(0.06, 8, 8);
    petalGeo.scale(1.75, 0.2, 6.75);
    for (let i = 0; i < 18; i++) {
      const petal = new THREE.Mesh(petalGeo, initialPetalMat);
      const angle = (i / 18) * Math.PI * 2;
      const radius = 0.275;
      petal.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      petal.rotation.y = -angle;
      petal.rotation.z = 0.15;
      flowerHead.add(petal);
      petalMeshes.push(petal);
    }
  }

  let shootTimer = 0;
  let chargeAmount = 0;
  let currentStrength = 0;
  const SHOOT_DURATION = 0.5;

  (flowerGroup as any).triggerShoot = (strength: number = 0.5) => {
    shootTimer = SHOOT_DURATION;
    currentStrength = strength;
  };

  (flowerGroup as any).setChargeAmount = (val: number) => {
    chargeAmount = val;
  };

  (flowerGroup as any).updateFlowerPhysics = (forward: number, side: number, dt: number = 0.016) => {
    const tiltBase = 0.4;
    let shootOffset = 0;
    if (shootTimer > 0) {
      shootTimer -= dt;
      const progress = 1.0 - (shootTimer / SHOOT_DURATION);
      if (progress < 0.2) {
        shootOffset = -chargeAmount * 1.5 - (progress / 0.2) * 0.5;
      } else if (progress < 0.4) {
        const p2 = (progress - 0.2) / 0.2;
        const snapMax = 1.0 + currentStrength * 2.5;
        shootOffset = -chargeAmount * 2.0 + p2 * (snapMax + chargeAmount * 2.0);
      } else {
        const p3 = (progress - 0.4) / 0.6;
        shootOffset = (1.0 + currentStrength * 2.5) * (1.0 - p3);
      }
    } else {
      shootOffset = -chargeAmount * 2.2;
    }

    const totalFwd = forward + shootOffset;
    stemSegments.forEach((seg, i) => {
      const t = i / (stemSegments.length - 1);
      const curve = Math.pow(t, 2);
      seg.position.z = curve * totalFwd * 1.1;
      seg.position.x = curve * side * 1.1;
      seg.rotation.x = t * totalFwd * 1.8;
      seg.rotation.z = -t * side * 1.8;
    });
    flowerHead.position.set(side * 1.1, stemHeight, totalFwd * 1.1);
    flowerHead.rotation.x = tiltBase + totalFwd * 2.2;
    flowerHead.rotation.z = -side * 2.2;
  };

  (flowerGroup as any).setPetalColor = (color: number) => {
    const mat = createPetalMat(color);
    petalMeshes.forEach(p => p.material = mat);
  };

  return flowerGroup;
};

const createStarShape = (outerRadius: number, innerRadius: number, points: number) => {
  const shape = new THREE.Shape();
  const PI2 = Math.PI * 2;
  for (let i = 0; i < points * 2; i++) {
    const r = (i % 2 === 0) ? outerRadius : innerRadius;
    const a = (i / (points * 2)) * PI2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
};

const createHeartShape = (scale: number) => {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.2 * scale);
  shape.bezierCurveTo(0.5 * scale, 0.6 * scale, 1.2 * scale, 0, 0, -0.8 * scale);
  shape.bezierCurveTo(-1.2 * scale, 0, -0.5 * scale, 0.6 * scale, 0, 0.2 * scale);
  return shape;
};

const createVisorModel = (visorColor: number, visorType: string = 'normal') => {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: visorColor, roughness: 0.2, metalness: 0.1 });
  const extrudeSettings = { depth: 0.05, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.01, bevelThickness: 0.01 };

  if (visorType === 'glasses') {
    const lensL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 32), mat);
    lensL.rotation.x = Math.PI / 2;
    lensL.position.set(-0.2, 0, 0);
    group.add(lensL);
    const lensR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 32), mat);
    lensR.rotation.x = Math.PI / 2;
    lensR.position.set(0.2, 0, 0);
    group.add(lensR);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.02), mat);
    group.add(bridge);
  } else if (visorType === 'sunglasses') {
    const lensL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.05), mat);
    lensL.position.set(-0.19, 0, 0);
    group.add(lensL);
    const lensR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.05), mat);
    lensR.position.set(0.19, 0, 0);
    group.add(lensR);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.02), mat);
    group.add(bridge);
  } else if (visorType === 'star') {
    const starGeoL = new THREE.ExtrudeGeometry(createStarShape(0.2, 0.08, 5), extrudeSettings);
    starGeoL.center();
    const lensL = new THREE.Mesh(starGeoL, mat);
    lensL.position.set(-0.2, 0, 0);
    group.add(lensL);

    const starGeoR = new THREE.ExtrudeGeometry(createStarShape(0.2, 0.08, 5), extrudeSettings);
    starGeoR.center();
    const lensR = new THREE.Mesh(starGeoR, mat);
    lensR.position.set(0.2, 0, 0);
    group.add(lensR);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.02), mat);
    group.add(bridge);
  } else if (visorType === 'heart') {
    const heartGeoL = new THREE.ExtrudeGeometry(createHeartShape(0.25), extrudeSettings);
    heartGeoL.center();
    // 하트 형태가 거꾸로 뒤집혀보일 수 있으므로 회전 처리 (테스트 결과 필요시)
    // 원점에서 베지어 커브를 그릴 때 y값이 양수면 위, 음수면 아래입니다. 
    const lensL = new THREE.Mesh(heartGeoL, mat);
    lensL.position.set(-0.2, 0, 0);
    group.add(lensL);

    const heartGeoR = new THREE.ExtrudeGeometry(createHeartShape(0.25), extrudeSettings);
    heartGeoR.center();
    const lensR = new THREE.Mesh(heartGeoR, mat);
    lensR.position.set(0.2, 0, 0);
    group.add(lensR);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.02), mat);
    group.add(bridge);
  } else {
    // Normal visor (기본보다 조금 더 두껍고 크게)
    const visorGeo = new THREE.BoxGeometry(0.65, 0.2, 0.1);
    const visor = new THREE.Mesh(visorGeo, mat);
    group.add(visor);
  }

  (group as any).setVisorColor = (color: number) => {
    mat.color.setHex(color);
  };
  return group;
};

const createCharacterModel = (bodyColor: number, flowerColor: number, flowerType: string = 'daisy', visorType: string = 'normal') => {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.1 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });

  const lowerBody = new THREE.Group();
  const bottomCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 32), whiteMat);
  bottomCyl.position.y = 0.75;
  lowerBody.add(bottomCyl);
  const bottomSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    whiteMat
  );
  bottomSphere.position.y = 0.5;
  lowerBody.add(bottomSphere);
  root.add(lowerBody);

  const upperBody = new THREE.Group();
  upperBody.position.y = 1.0;
  root.add(upperBody);

  const topCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 32), bodyMat);
  topCyl.position.y = 0.25;
  upperBody.add(topCyl);
  const topSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    bodyMat
  );
  topSphere.position.y = 0.5;
  upperBody.add(topSphere);

  let visor = createVisorModel(0x333333, visorType);
  visor.position.set(0, 0.4, 0.48);
  upperBody.add(visor);

  let flower = createFlowerModel(flowerColor, flowerType);
  flower.position.y = 0.6;
  upperBody.add(flower);

  (root as any).setBodyColor = (c: number) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.1 });
    topCyl.material = m;
    topSphere.material = m;
  };
  (root as any).setFlowerColor = (c: number) => {
    if ((flower as any).setPetalColor) (flower as any).setPetalColor(c);
  };
  (root as any).setVisorColor = (c: number) => {
    if ((visor as any).setVisorColor) (visor as any).setVisorColor(c);
  };
  (root as any).updateFlowerPhysics = (f: number, s: number, dt: number) => {
    if ((flower as any).updateFlowerPhysics) (flower as any).updateFlowerPhysics(f, s, dt);
  };
  (root as any).setVisorStyle = (c: number, t: string) => {
    upperBody.remove(visor);
    visor = createVisorModel(c, t);
    visor.position.set(0, 0.4, 0.48);
    upperBody.add(visor);
  };
  (root as any).setFlowerStyle = (c: number, t: string) => {
    upperBody.remove(flower);
    flower = createFlowerModel(c, t);
    flower.position.y = 0.6;
    upperBody.add(flower);
  };

  (root as any).triggerShootAnimation = (strength: number = 0.5) => {
    if ((flower as any).triggerShoot) (flower as any).triggerShoot(strength);
  };
  (root as any).setChargeAmount = (val: number) => {
    if ((flower as any).setChargeAmount) (flower as any).setChargeAmount(val);
  };

  return root;
};

// ─── Preview3D 클래스 ─────────────────────────────────────────

export class Preview3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;
  private model: THREE.Group | null = null;
  private animId = 0;
  private bgmAudio: HTMLAudioElement | null = null;

  private isDragging = false;
  private prevMouseX = 0;
  private prevMouseY = 0;
  private rotY = 0;
  private rotX = 0.3;

  private _onMouseMove: (e: MouseEvent) => void;
  private _onMouseUp: () => void;
  private _onKeyDown: (e: KeyboardEvent) => void;

  private isCharging = false;
  private chargeAmount = 0;
  private MAX_CHARGE_TIME = 1.2;

  private _onStartCharge = () => {
    this.isCharging = true;
  };
  private _onReleaseCharge = () => {
    if (this.isCharging && this.model) {
      this.isCharging = false;
      const strength = Math.min(this.chargeAmount, 1.0);
      (this.model as any).triggerShootAnimation(strength);
      this.chargeAmount = 0;
      (this.model as any).setChargeAmount(0);
    }
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.setSize(canvas.clientWidth || 400, canvas.clientHeight || 400);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xA2D2FF);

    this.camera = new THREE.PerspectiveCamera(50, (canvas.clientWidth || 400) / (canvas.clientHeight || 400), 0.1, 100);
    this.camera.position.set(0, 2, 5);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xb9f3fc, 1.0);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(5, 10, 5);
    this.scene.add(dir);

    // 이벤트 핸들러를 멤버로 저장 (나중에 제거 가능)
    this._onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return;
      this.rotY += (e.clientX - this.prevMouseX) * 0.01;
      this.rotX += (e.clientY - this.prevMouseY) * 0.005;
      this.rotX = Math.max(-0.5, Math.min(1.0, this.rotX));
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
    };
    this._onMouseUp = () => { this.isDragging = false; };
    this._onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isFormField = active instanceof HTMLInputElement
        || active instanceof HTMLSelectElement
        || active instanceof HTMLTextAreaElement;
      if (isFormField) return;

      if (e.key.startsWith('Arrow')) e.preventDefault();
      if (e.key === 'ArrowLeft') this.rotY -= 0.05;
      if (e.key === 'ArrowRight') this.rotY += 0.05;
      if (e.key === 'ArrowUp') this.rotX = Math.max(-0.5, this.rotX - 0.05);
      if (e.key === 'ArrowDown') this.rotX = Math.min(1.0, this.rotX + 0.05);
    };

    canvas.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keydown', (e) => {
      this._onKeyDown(e);
      if (e.code === 'KeyF') this._onStartCharge();
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyF') this._onReleaseCharge();
    });

    canvas.addEventListener('mousedown', (e) => {
      canvas.focus();
      this.isDragging = true;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
      if (e.button === 0) this._onStartCharge();
    });
    window.addEventListener('mouseup', (e) => {
      this.isDragging = false;
      if (e.button === 0) this._onReleaseCharge();
    });

    this._animate();
  }

  loadCharacter(bodyColor: string, flowerColor: string, visorColor: string, flowerType: string = 'daisy', visorType: string = 'normal') {
    if (this.model) { this.scene.remove(this.model); this.model = null; }
    this.scene.background = new THREE.Color(0xA2D2FF);
    this.scene.fog = null;
    this.model = createCharacterModel(toThreeColor(bodyColor), toThreeColor(flowerColor), flowerType, visorType);
    (this.model as any).setVisorColor(toThreeColor(visorColor));
    this.model.position.set(0, -1, 0);
    this.scene.add(this.model);
  }

  loadMap(config: MapData) {
    if (this.model) { this.scene.remove(this.model); this.model = null; }

    this.scene.background = new THREE.Color(config.bgColor);
    if (config.fogDensity > 0) {
      this.scene.fog = new THREE.FogExp2(new THREE.Color(config.bgColor).getHex(), config.fogDensity);
    } else {
      this.scene.fog = null;
    }

    const group = new THREE.Group();

    // 단순화된 바닥 (preview 용으로 스케일을 줄임)
    const scale = 0.05; // 실제 코어 사이즈 400을 preview 용 20 정도로 축소
    const previewFloorSize = config.floorSize * scale;
    const islandGeo = new THREE.BoxGeometry(previewFloorSize, 2, previewFloorSize, 10, 1, 10);
    const islandMat = new THREE.MeshStandardMaterial({ color: 0x5a9e3a, roughness: 1 });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.y = -1;
    group.add(island);

    // 샘플 장애물 배치
    let seedVal = config.seed;
    const seededRandom = () => {
      seedVal = (seedVal * 1664525 + 1013904223) & 0xffffffff;
      return (seedVal >>> 0) / 0xffffffff;
    };

    const colors = config.obstacleColors.map(c => new THREE.Color(c).getHex());
    const previewPlayZone = config.playZone * scale;
    // 너무 많으면 버벅이므로 최대 20개만 표시
    const obstacleCount = Math.min(20, config.obstacleCount);

    for (let i = 0; i < obstacleCount; i++) {
      if (colors.length === 0) break;
      const color = colors[Math.floor(seededRandom() * colors.length)];

      let obs;
      if (config.theme === 'pastel') {
        obs = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5), new THREE.MeshStandardMaterial({ color }));
        obs.position.y = 0.75;
      } else if (config.theme === 'neon') {
        obs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 0.5), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1 }));
        obs.position.y = 1.0;
      } else if (config.theme === 'candy') {
        obs = new THREE.Mesh(new THREE.SphereGeometry(0.6), new THREE.MeshStandardMaterial({ color }));
        obs.position.y = 0.6;
      } else {
        obs = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial({ color }));
        obs.position.y = 0.4;
      }

      const rx = seededRandom() * previewPlayZone * 2 - previewPlayZone;
      const rz = seededRandom() * previewPlayZone * 2 - previewPlayZone;

      obs.position.x = rx;
      obs.position.z = rz;
      group.add(obs);
    }

    this.model = group;
    this.scene.add(this.model);

    // BGM 재생
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio = null;
    }
    if (config.bgmFile) {
      const audio = new Audio(`/sounds/bgm/${config.bgmFile}.mp3`);
      audio.loop = true;
      audio.volume = 0.4;
      audio.play().catch(() => {/* autoplay 차단 시 무시 */});
      this.bgmAudio = audio;
    }
  }

  updateColor(type: 'body' | 'flower' | 'visor', hexColor: string, styleType: string = 'daisy') {
    if (!this.model) return;
    const c = toThreeColor(hexColor);
    if (type === 'body') (this.model as any).setBodyColor(c);
    if (type === 'flower') (this.model as any).setFlowerStyle(c, styleType);
    if (type === 'visor') (this.model as any).setVisorStyle(c, styleType);
  }

  private _animate = () => {
    const dt = 0.016; // approximated
    this.animId = requestAnimationFrame(this._animate);
    if (this.model) {
      if (!this.isDragging) this.rotY += 0.005;
      this.model.rotation.y = this.rotY;
      this.model.rotation.x = this.rotX * 0.25;
      
      if ((this.model as any).updateFlowerPhysics) {
        (this.model as any).updateFlowerPhysics(0, 0, dt);
      }
      if (this.isCharging) {
        this.chargeAmount += dt / this.MAX_CHARGE_TIME;
        if (this.chargeAmount > 1.0) this.chargeAmount = 1.0;
        (this.model as any).setChargeAmount(this.chargeAmount);
      }
    }
    this.camera.position.set(0, 2, 5);
    this.camera.lookAt(0, 1, 0);
    this.renderer.render(this.scene, this.camera);
  };

  destroy() {
    cancelAnimationFrame(this.animId);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keydown', this._onKeyDown);
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio = null;
    }
    this.renderer.dispose();
  }
}
