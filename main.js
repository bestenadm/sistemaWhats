document.addEventListener('DOMContentLoaded', function() {
    // Simular carregamento de contatos e grupos da API
    const contacts = [
        { id: 'c1', name: 'João Silva', number: '5511999990001' },
        { id: 'c2', name: 'Maria Oliveira', number: '5511999990002' },
        { id: 'c3', name: 'Carlos Santos', number: '5511999990003' }
    ];
    
    const groups = [
        { id: 'g1', name: 'Família', number: 'group1' },
        { id: 'g2', name: 'Trabalho', number: 'group2' },
        { id: 'g3', name: 'Amigos', number: 'group3' }
    ];
    
    const recipientTypeSelect = document.getElementById('recipientType');
    const recipientSelect = document.getElementById('recipientSelect');
    const addRecipientBtn = document.getElementById('addRecipient');
    const selectedRecipients = document.getElementById('selectedRecipients');
    const attachmentInput = document.getElementById('attachment');
    const fileInfo = document.getElementById('fileInfo');
    const whatsappForm = document.getElementById('whatsappForm');
    const statusMessage = document.getElementById('statusMessage');
    
    // Atualizar opções com base no tipo de destinatário
    function updateRecipientOptions() {
        recipientSelect.innerHTML = '<option value="">-- Selecione --</option>';
        
        const type = recipientTypeSelect.value;
        const options = type === 'contact' ? contacts : groups;
        
        options.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.dataset.number = item.number;
            option.textContent = item.name;
            recipientSelect.appendChild(option);
        });
    }
    
    // Mostrar informações do arquivo anexado
    attachmentInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            const file = this.files[0];
            fileInfo.textContent = `${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
        } else {
            fileInfo.textContent = '';
        }
    });
    
    // Adicionar destinatário à lista de selecionados
    addRecipientBtn.addEventListener('click', function() {
        const selected = recipientSelect.options[recipientSelect.selectedIndex];
        
        if (selected.value) {
            const type = recipientTypeSelect.value;
            const label = type === 'contact' ? 'Contato' : 'Grupo';
            
            // Verificar se já está na lista
            const existingElements = document.querySelectorAll(`[data-id="${selected.value}"]`);
            if (existingElements.length > 0) return;
            
            const recipientEl = document.createElement('span');
            recipientEl.className = 'recipient';
            recipientEl.dataset.id = selected.value;
            recipientEl.dataset.number = selected.dataset.number;
            recipientEl.innerHTML = `${label}: ${selected.textContent} <button type="button">&times;</button>`;
            
            recipientEl.querySelector('button').addEventListener('click', function() {
                recipientEl.remove();
            });
            
            selectedRecipients.appendChild(recipientEl);
        }
    });
    
    // Enviar formulário
    whatsappForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const recipients = Array.from(selectedRecipients.querySelectorAll('.recipient')).map(el => ({
            id: el.dataset.id,
            number: el.dataset.number
        }));
        
        if (recipients.length === 0) {
            showStatus('Por favor, selecione pelo menos um destinatário.', 'error');
            return;
        }
        
        const message = document.getElementById('message').value.trim();
        if (!message) {
            showStatus('Por favor, digite uma mensagem.', 'error');
            return;
        }
        
        // Coletar dados do formulário
        const formData = new FormData();
        formData.append('message', message);
        formData.append('recipients', JSON.stringify(recipients));
        
        if (attachmentInput.files.length > 0) {
            formData.append('attachment', attachmentInput.files[0]);
        }
        
        const scheduleTime = document.getElementById('scheduleTime').value;
        if (scheduleTime) {
            formData.append('scheduleTime', scheduleTime);
        }
        
        // Simulação de envio para a API
        showStatus('Enviando mensagem...', '');
        
        // Simulando uma chamada à API
        setTimeout(() => {
            // Em um cenário real, aqui faríamos o fetch para a API
            showStatus('Mensagem enviada com sucesso!', 'success');
            whatsappForm.reset();
            selectedRecipients.innerHTML = '';
            fileInfo.textContent = '';
        }, 1500);
    });
    
    // Exibir mensagem de status
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = 'status-msg ' + type;
        statusMessage.style.display = 'block';
        
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                statusMessage.style.display = 'none';
            }, 5000);
        }
    }
    
    // Atualizar opções iniciais
    recipientTypeSelect.addEventListener('change', updateRecipientOptions);
    updateRecipientOptions();
});