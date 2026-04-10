import * as THREE from 'three';

/**
 * 스튜디오 느낌의 절차적 HDR 환경맵 생성 (외부 .hdr 파일 없이 동작)
 */
export function setupEnvMap(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    const width = 512, height = 256;
    const data = new Float32Array(width * height * 4);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const phi   = (y / height) * Math.PI;       // 0(top) ~ PI(bottom)
            const theta = (x / width)  * Math.PI * 2;   // 0 ~ 2PI

            // 구면 좌표 → 방향 벡터
            const dx = Math.sin(phi) * Math.cos(theta);
            const dy = Math.cos(phi);
            const dz = Math.sin(phi) * Math.sin(theta);

            // 하늘 그라데이션 (위쪽 밝은 회색-파랑)
            const up = Math.max(0, dy);
            data[i]     = 0.35 + up * 0.35;
            data[i + 1] = 0.45 + up * 0.35;
            data[i + 2] = 0.70 + up * 0.30;
            data[i + 3] = 1.0;

            // 키 라이트 (상단 우측 앞)
            const kDot = Math.max(0, dx * 0.6 + dy * 0.7 + dz * 0.4);
            if (kDot > 0.96) {
                const t = (kDot - 0.96) / 0.04;
                data[i]     += 5.0 * t;
                data[i + 1] += 5.0 * t;
                data[i + 2] += 5.2 * t;
            }

            // 필 라이트 (상단 좌측 뒤, 약간 파란 빛)
            const fDot = Math.max(0, -dx * 0.5 + dy * 0.65 + dz * -0.6);
            if (fDot > 0.94) {
                const t = (fDot - 0.94) / 0.06;
                data[i]     += 1.5 * t;
                data[i + 1] += 2.0 * t;
                data[i + 2] += 3.5 * t;
            }

            // 림 라이트 (측면, 청록 색조)
            const rDot = Math.max(0, dz * -0.9 + dy * 0.3);
            if (rDot > 0.92) {
                const t = (rDot - 0.92) / 0.08;
                data[i]     += 1.0 * t;
                data[i + 1] += 2.5 * t;
                data[i + 2] += 3.0 * t;
            }
        }
    }

    const hdrTex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
    hdrTex.mapping = THREE.EquirectangularReflectionMapping;
    hdrTex.colorSpace = THREE.LinearSRGBColorSpace;
    hdrTex.needsUpdate = true;

    const envMap = pmrem.fromEquirectangular(hdrTex).texture;
    scene.environment = envMap;

    hdrTex.dispose();
    pmrem.dispose();
}
