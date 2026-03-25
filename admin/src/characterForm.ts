import { CharacterData, createCharacter, updateCharacter } from './api';
import { Preview3D } from './preview3d';

let preview: Preview3D | null = null;

const defaultChar = (): Omit<CharacterData, '_id'> => ({
  name: '',
  description: '',
  bodyColor: '#FFB7B2',
  flowerColor: '#FFB7B2',
  visorColor: '#333333',
  flowerType: 'daisy',
  visorType: 'normal',
});

export const renderForm = (char: CharacterData | null, onSaved: () => void) => {
  const container = document.getElementById('form-container')!;
  const data = char ? { ...char } : defaultChar();

  container.innerHTML = `
    <h2 style="margin-bottom:20px;font-size:16px;">${char ? '캐릭터 편집' : '새 캐릭터'}</h2>
    <div class="form-inner">
      <div class="preview-col">
        <canvas id="preview-canvas" tabindex="0"></canvas>
      </div>
      <div class="fields-col">
        <div class="form-group">
          <label>이름 *</label>
          <input id="f-name" type="text" maxlength="20" value="${data.name}" placeholder="캐릭터 이름 (최대 20자)" />
        </div>
        <div class="form-group">
          <label>설명</label>
          <input id="f-desc" type="text" maxlength="100" value="${data.description || ''}" placeholder="설명 (최대 100자)" />
        </div>
        <div class="form-group">
          <label>바디 컬러</label>
          <div class="color-row">
            <input id="f-body" type="color" value="${data.bodyColor}" />
            <input id="f-body-text" type="text" value="${data.bodyColor}" maxlength="7" />
          </div>
        </div>
        <div class="form-group">
          <label>꽃 컬러</label>
          <div class="color-row">
            <input id="f-flower" type="color" value="${data.flowerColor}" />
            <input id="f-flower-text" type="text" value="${data.flowerColor}" maxlength="7" />
          </div>
        </div>
        <div class="form-group">
          <label>바이저 색</label>
          <div class="color-row">
            <input id="f-visor" type="color" value="${data.visorColor}" />
            <input id="f-visor-text" type="text" value="${data.visorColor}" maxlength="7" />
          </div>
        </div>
        <div class="form-group">
          <label>꽃 종류</label>
          <select id="f-type">
            <option value="daisy" ${data.flowerType === 'daisy' ? 'selected' : ''}>Daisy (데이지)</option>
            <option value="rose" ${data.flowerType === 'rose' ? 'selected' : ''}>Rose (장미)</option>
            <option value="tulip" ${data.flowerType === 'tulip' ? 'selected' : ''}>Tulip (튤립)</option>
            <option value="sunflower" ${data.flowerType === 'sunflower' ? 'selected' : ''}>Sunflower (해바라기)</option>
            <option value="clover" ${data.flowerType === 'clover' ? 'selected' : ''}>Clover (네잎클로버)</option>
          </select>
        </div>
        <div class="form-group">
          <label>바이저 분류</label>
          <select id="f-visor-type">
            <option value="normal" ${data.visorType === 'normal' || !data.visorType ? 'selected' : ''}>Normal (일반)</option>
            <option value="glasses" ${data.visorType === 'glasses' ? 'selected' : ''}>Glasses (안경)</option>
            <option value="sunglasses" ${data.visorType === 'sunglasses' ? 'selected' : ''}>Sunglasses (선글라스)</option>
            <option value="star" ${data.visorType === 'star' ? 'selected' : ''}>Star (별 모양)</option>
            <option value="heart" ${data.visorType === 'heart' ? 'selected' : ''}>Heart (하트 모양)</option>
          </select>
        </div>
        <div class="form-actions">
          <button id="save-btn">저장</button>
          <button id="cancel-btn">취소</button>
        </div>
      </div>
    </div>
  `;

  // 3D 미리보기 초기화
  const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
  const parent = canvas.parentElement;
  canvas.width = parent ? parent.clientWidth : 600;
  canvas.height = 600;
  if (preview) preview.destroy();
  preview = new Preview3D(canvas);
  preview.loadCharacter(data.bodyColor, data.flowerColor, data.visorColor, data.flowerType || 'daisy', data.visorType || 'normal');

  // 색상 입력 동기화 헬퍼
  const syncColor = (pickerId: string, textId: string, colorType: 'body' | 'flower' | 'visor') => {
    const picker = document.getElementById(pickerId) as HTMLInputElement;
    const text = document.getElementById(textId) as HTMLInputElement;

    picker.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      text.value = val;
      const fType = (document.getElementById('f-type') as HTMLSelectElement).value;
      const vType = (document.getElementById('f-visor-type') as HTMLSelectElement).value;
      preview?.updateColor(colorType, val, colorType === 'flower' ? fType : (colorType === 'visor' ? vType : undefined));
    });

    text.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        picker.value = val;
        const fType = (document.getElementById('f-type') as HTMLSelectElement).value;
        const vType = (document.getElementById('f-visor-type') as HTMLSelectElement).value;
        preview?.updateColor(colorType, val, colorType === 'flower' ? fType : (colorType === 'visor' ? vType : undefined));
      }
    });
  };

  syncColor('f-body', 'f-body-text', 'body');
  syncColor('f-flower', 'f-flower-text', 'flower');
  syncColor('f-visor', 'f-visor-text', 'visor');

  document.getElementById('f-type')!.addEventListener('change', (e) => {
    const type = (e.target as HTMLSelectElement).value;
    const color = (document.getElementById('f-flower') as HTMLInputElement).value;
    preview?.updateColor('flower', color, type);
  });

  document.getElementById('f-visor-type')!.addEventListener('change', (e) => {
    const type = (e.target as HTMLSelectElement).value;
    const color = (document.getElementById('f-visor') as HTMLInputElement).value;
    preview?.updateColor('visor', color, type);
  });

  // 저장
  document.getElementById('save-btn')!.addEventListener('click', async () => {
    const payload: Omit<CharacterData, '_id'> = {
      name: (document.getElementById('f-name') as HTMLInputElement).value.trim(),
      description: (document.getElementById('f-desc') as HTMLInputElement).value.trim(),
      bodyColor: (document.getElementById('f-body') as HTMLInputElement).value,
      flowerColor: (document.getElementById('f-flower') as HTMLInputElement).value,
      visorColor: (document.getElementById('f-visor') as HTMLInputElement).value,
      flowerType: (document.getElementById('f-type') as HTMLSelectElement).value,
      visorType: (document.getElementById('f-visor-type') as HTMLSelectElement).value,
    };

    if (!payload.name) { alert('이름을 입력해주세요.'); return; }

    try {
      if (char?._id) {
        await updateCharacter(char._id, payload);
      } else {
        await createCharacter(payload);
      }
      onSaved();
    } catch (err: any) {
      alert('저장 실패: ' + err.message);
    }
  });

  // 취소
  document.getElementById('cancel-btn')!.addEventListener('click', () => {
    container.innerHTML = '<p style="color:#aaa;padding:20px;">좌측에서 캐릭터를 선택하거나 새 캐릭터를 추가하세요.</p>';
    if (preview) { preview.destroy(); preview = null; }
  });
};
