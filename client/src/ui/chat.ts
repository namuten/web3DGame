export const initChat = (onSendMessage: (msg: string) => void) => {
    // 채팅 표시 컨테이너
    const chatContainer = document.createElement('div');
    chatContainer.style.position = 'absolute';
    chatContainer.style.bottom = '120px';
    chatContainer.style.left = '20px';
    chatContainer.style.width = '300px';
    chatContainer.style.height = '200px';
    chatContainer.style.background = 'linear-gradient(135deg, rgba(15, 15, 30, 0.6), rgba(30, 20, 50, 0.4))';
    chatContainer.style.borderRadius = '5px';
    chatContainer.style.display = 'flex';
    chatContainer.style.flexDirection = 'column';
    chatContainer.style.overflow = 'hidden';
    chatContainer.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    chatContainer.style.boxShadow = '0 8px 32px 0 rgba(31, 38, 135, 0.37)';
    chatContainer.style.backdropFilter = 'blur(8px)';
    (chatContainer.style as any)['-webkit-backdrop-filter'] = 'blur(8px)';
    chatContainer.style.pointerEvents = 'auto'; // 입력 등을 위해 클릭 허용
    document.body.appendChild(chatContainer);

    // 메시지 기록 영역
    const messagesDiv = document.createElement('div');
    messagesDiv.id = 'chat-messages';
    messagesDiv.style.flex = '1';
    messagesDiv.style.overflowY = 'auto';
    messagesDiv.style.padding = '10px';
    messagesDiv.style.color = '#E0E0FF';
    messagesDiv.style.fontFamily = 'monospace';
    messagesDiv.style.fontSize = '12px';
    messagesDiv.style.display = 'flex';
    messagesDiv.style.flexDirection = 'column';
    messagesDiv.style.gap = '5px';
    chatContainer.appendChild(messagesDiv);

    // 입력창 영역
    const inputArea = document.createElement('div');
    inputArea.style.display = 'flex';
    inputArea.style.borderTop = '1px solid rgba(255, 255, 255, 0.15)';
    chatContainer.appendChild(inputArea);

    const inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.placeholder = 'Press Enter to jack in...';
    inputField.style.flex = '1';
    inputField.style.backgroundColor = 'transparent';
    inputField.style.border = 'none';
    inputField.style.color = '#E0E0FF';
    inputField.style.padding = '10px';
    inputField.style.outline = 'none';
    inputField.style.fontFamily = 'monospace';
    inputField.style.fontSize = '12px';
    inputArea.appendChild(inputField);

    inputField.style.setProperty('caret-color', '#20FFC9');

    const placeholderStyle = document.createElement('style');
    placeholderStyle.textContent = `
        input::placeholder {
            color: rgba(224, 224, 255, 0.6);
        }
    `;
    document.head.appendChild(placeholderStyle);

    // 엔터키 전송 이벤트
    inputField.addEventListener('keydown', (e) => {
        // 게임내 WASD 조작을 위해 입력창 밖에서는 입력을 무시하지만,
        // 입력창에 포커스 되었을 때는 WASD 조작을 막아야 함 (이벤트 전파 중단)
        e.stopPropagation();

        // 한글 조합 중(IME) 엔터키가 두 번 발생하는 문제 방지
        if (e.isComposing) return;

        if (e.key === 'Enter') {
            const msg = inputField.value.trim();
            if (msg) {
                onSendMessage(msg);
                inputField.value = '';
            }
            inputField.blur(); // 전송 후 포커스 해제
        }
    });

    // 전역 엔터키 감지 시 채팅 입력창 활성화
    window.addEventListener('keydown', (e) => {
        if (e.isComposing) return; // 한글 조합 중 방지
        
        if (e.key === 'Enter' && document.activeElement !== inputField) {
            inputField.focus();
        }
    });

    // 안내 메시지 최초 추가
    appendMessage('System', 'Welcome to Web3D Cyber Space!', '#00f0ff');
};

export const appendMessage = (sender: string, text: string, color: string = '#ccc') => {
    const messagesDiv = document.getElementById('chat-messages');
    if (!messagesDiv) return;

    const msgEl = document.createElement('div');
    msgEl.style.color = '#E0E0FF';
    msgEl.innerHTML = `<span style="color: ${color}; font-weight: bold;">[${sender.substring(0, 12)}]</span> ${text}`;
    
    messagesDiv.appendChild(msgEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight; // 가장 아래로 스크롤
};
