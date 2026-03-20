import * as THREE from 'three';
import { toThreeColor } from './utils';

// ─── characterModel 복사 (admin 전용) ────────────────────────

const createFlowerModel = (flowerColor: number) => {
  const flowerGroup = new THREE.Group();
  const stemSegments: THREE.Mesh[] = [];
  const stemPointCount = 8;
  const stemHeight = 0.8;
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27 });

  for (let i = 0; i < stemPointCount; i++) {
    const t = i / (stemPointCount - 1);
    const segment = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, stemHeight / stemPointCount),
      stemMat
    );
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

  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.08),
    new THREE.MeshStandardMaterial({ color: 0xffcc00 })
  );
  center.scale.set(1, 0.6, 1);
  flowerHead.add(center);

  const petalGeo = new THREE.SphereGeometry(0.03, 8, 8);
  petalGeo.scale(1.5, 0.2, 5);
  const petalMat = new THREE.MeshStandardMaterial({ color: flowerColor, roughness: 0.1 });

  for (let i = 0; i < 18; i++) {
    const petal = new THREE.Mesh(petalGeo, petalMat);
    const angle = (i / 18) * Math.PI * 2;
    petal.position.set(Math.cos(angle) * 0.18, 0, Math.sin(angle) * 0.18);
    petal.rotation.y = -angle;
    petal.rotation.z = 0.1;
    flowerHead.add(petal);
  }

  (flowerGroup as any).setPetalColor = (color: number) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.1 });
    flowerHead.children.forEach(c => {
      if (c instanceof THREE.Mesh && c !== center) c.material = mat;
    });
  };

  return flowerGroup;
};

const createCharacterModel = (bodyColor: number, flowerColor: number) => {
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

  const visorGeo = new THREE.BoxGeometry(0.6, 0.15, 0.1);
  let visorMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.2, metalness: 0.1 });
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.4, 0.48);
  upperBody.add(visor);

  const flower = createFlowerModel(flowerColor);
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
    visor.material = new THREE.MeshStandardMaterial({ color: c, roughness: 0.2, metalness: 0.1 });
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

  private isDragging = false;
  private prevMouseX = 0;
  private prevMouseY = 0;
  private rotY = 0;
  private rotX = 0.3;

  private _onMouseMove: (e: MouseEvent) => void;
  private _onMouseUp: () => void;
  private _onKeyDown: (e: KeyboardEvent) => void;

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
      if (e.key === 'ArrowLeft')  this.rotY -= 0.05;
      if (e.key === 'ArrowRight') this.rotY += 0.05;
      if (e.key === 'ArrowUp')    this.rotX = Math.max(-0.5, this.rotX - 0.05);
      if (e.key === 'ArrowDown')  this.rotX = Math.min(1.0,  this.rotX + 0.05);
    };

    canvas.addEventListener('mousedown', (e) => {
      canvas.focus();
      this.isDragging = true;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
    });
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keydown', this._onKeyDown);

    this._animate();
  }

  loadCharacter(bodyColor: string, flowerColor: string, visorColor: string) {
    if (this.model) this.scene.remove(this.model);
    this.model = createCharacterModel(toThreeColor(bodyColor), toThreeColor(flowerColor));
    (this.model as any).setVisorColor(toThreeColor(visorColor));
    this.model.position.set(0, -1, 0);
    this.scene.add(this.model);
  }

  updateColor(type: 'body' | 'flower' | 'visor', hexColor: string) {
    if (!this.model) return;
    const c = toThreeColor(hexColor);
    if (type === 'body')   (this.model as any).setBodyColor(c);
    if (type === 'flower') (this.model as any).setFlowerColor(c);
    if (type === 'visor')  (this.model as any).setVisorColor(c);
  }

  private _animate = () => {
    this.animId = requestAnimationFrame(this._animate);
    if (this.model) {
      if (!this.isDragging) this.rotY += 0.005;
      this.model.rotation.y = this.rotY;
      this.model.rotation.x = this.rotX * 0.25;
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
    this.renderer.dispose();
  }
}
