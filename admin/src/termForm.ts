import { TermData, createTerm, updateTerm } from './termApi';

export const renderTermForm = (term: TermData | null, onSaved: () => void) => {
  const container = document.getElementById('term-form-container')!;

  container.innerHTML = `
    <div class="max-w-xl mx-auto flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div class="text-center">
        <span class="px-3 py-1 bg-tertiary/10 text-tertiary text-[10px] rounded-full font-headline tracking-widest uppercase mb-2 inline-block">Lexicon Management</span>
        <h2 class="text-3xl font-headline font-bold text-primary tracking-tight">${term ? '용어 정보 수정' : '새 용어 추가'}</h2>
        <p class="text-sm text-on-surface-variant mt-2">게임 내에서 사용되는 용어와 대사를 관리합니다.</p>
      </div>

      <div class="bg-surface-container rounded-2xl p-8 border border-white/50 shadow-inner flex flex-col gap-6">
        <div class="space-y-2">
          <label class="text-xs font-bold text-tertiary uppercase tracking-widest pl-1">용어(단어)</label>
          <input id="t-term" type="text" maxlength="10" placeholder="예: 시공간의 균열" 
            class="w-full bg-white border-none rounded-xl py-3.5 px-6 focus:ring-2 focus:ring-tertiary text-sm font-bold transition-all shadow-sm" />
        </div>
        
        <div class="space-y-2">
          <label class="text-xs font-bold text-tertiary uppercase tracking-widest pl-1">상세 설명 및 대사</label>
          <textarea id="t-desc" maxlength="200" rows="5" placeholder="용어의 뜻이나 실제 출력될 대사를 입력하세요..." 
            class="w-full bg-white border-none rounded-xl py-4 px-6 focus:ring-2 focus:ring-tertiary text-sm transition-all shadow-sm leading-relaxed resize-none"></textarea>
          <p class="text-[10px] text-right text-tertiary/60 font-medium">최대 200자까지 입력 가능</p>
        </div>

        <div class="flex gap-3 mt-4">
          <button id="t-save-btn" class="flex-1 py-4 bg-gradient-to-br from-tertiary to-tertiary-container text-on-tertiary rounded-2xl shadow-lg shadow-tertiary/20 hover:shadow-tertiary/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all font-headline font-bold text-sm flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-lg">edit_note</span>
            설정 저장
          </button>
          <button id="t-cancel-btn" class="px-6 py-4 bg-surface-container-low text-on-surface-variant rounded-2xl border border-white/50 hover:bg-white transition-all font-headline font-semibold text-sm">
            취소
          </button>
        </div>
      </div>

      ${term ? `
      <div class="flex items-center gap-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
        <span class="material-symbols-outlined text-primary">info</span>
        <div class="text-[10px]">
          <p class="font-bold text-primary uppercase tracking-widest">Metadata</p>
          <p class="text-on-surface-variant leading-tight">First inscribed: ${new Date(term.createdAt!).toLocaleString()}</p>
        </div>
      </div>
      ` : ''}
    </div>
  `;

  // Set values via DOM properties (XSS-safe)
  (document.getElementById('t-term') as HTMLInputElement).value = term?.term ?? '';
  (document.getElementById('t-desc') as HTMLTextAreaElement).value = term?.description ?? '';

  document.getElementById('t-cancel-btn')!.addEventListener('click', () => {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-center p-12 opacity-50">
        <span class="material-symbols-outlined text-6xl mb-4 text-tertiary">history_edu</span>
        <p class="font-headline font-semibold text-lg">Review and edit the dimensional vocabulary</p>
      </div>
    `;
  });

  document.getElementById('t-save-btn')!.addEventListener('click', async () => {
    const termVal = (document.getElementById('t-term') as HTMLInputElement).value.trim();
    const descVal = (document.getElementById('t-desc') as HTMLTextAreaElement).value.trim();

    if (!termVal) { alert('Enter term.'); return; }
    if (!descVal) { alert('Enter definition.'); return; }

    try {
      if (term?.id) {
        await updateTerm(term.id, { term: termVal, description: descVal });
      } else {
        await createTerm({ term: termVal, description: descVal });
      }
      alert('Knowledge Inscribed.');
      onSaved();
    } catch (e: any) {
      alert('Inscription failed: ' + e.message);
    }
  });
};
