import { TermData, createTerm, updateTerm } from './termApi';

export const renderTermForm = (term: TermData | null, onSaved: () => void) => {
  const container = document.getElementById('term-form-container')!;

  container.innerHTML = `
    <h2 style="margin-bottom:20px;font-size:16px;">${term ? '용어 편집' : '새 용어'}</h2>
    <div class="fields-col" style="max-width:480px;">
      <div class="form-group">
        <label>용어 * (최대 10자)</label>
        <input id="t-term" type="text" maxlength="10" value="${term?.term ?? ''}" placeholder="예: 퀀텀역학" />
      </div>
      <div class="form-group">
        <label>설명 * (최대 200자)</label>
        <textarea id="t-desc" maxlength="200" rows="4" placeholder="용어에 대한 설명을 입력하세요">${term?.description ?? ''}</textarea>
      </div>
      <div class="form-actions">
        <button id="t-save-btn" style="background:#51cf66;color:#fff;">저장</button>
        <button id="t-cancel-btn" style="background:#dee2e6;color:#333;">취소</button>
      </div>
    </div>
  `;

  document.getElementById('t-cancel-btn')!.addEventListener('click', () => {
    container.innerHTML = '<p style="color:#aaa;padding:20px;">좌측에서 용어를 선택하거나 새 용어를 추가하세요.</p>';
  });

  document.getElementById('t-save-btn')!.addEventListener('click', async () => {
    const termVal = (document.getElementById('t-term') as HTMLInputElement).value.trim();
    const descVal = (document.getElementById('t-desc') as HTMLTextAreaElement).value.trim();

    if (!termVal) { alert('용어를 입력하세요.'); return; }
    if (!descVal) { alert('설명을 입력하세요.'); return; }

    try {
      if (term?.id) {
        await updateTerm(term.id, { term: termVal, description: descVal });
      } else {
        await createTerm({ term: termVal, description: descVal });
      }
      alert('저장되었습니다.');
      onSaved();
    } catch (e: any) {
      alert('저장 실패: ' + e.message);
    }
  });
};
