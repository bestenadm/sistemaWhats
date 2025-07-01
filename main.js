// --- Configuração do Supabase ---
// Insira suas credenciais do Supabase aqui.
const SUPABASE_URL = 'https://xatnmvmhmfugdtaqoclm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhdG5tdm1obWZ1Z2R0YXFvY2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyODcyODksImV4cCI6MjA2Njg2MzI4OX0.EKg9-ZK5O1Qse8Nj0mH7kxWS73Ap278x8Ck8h5q2dRU';

// Inicializa o cliente Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Configuração da API ---
const API_URL = 'http://localhost:3000'; // URL do seu servidor backend (api.js)

// Variáveis globais
let contacts = [];
let groups = [];

// Elementos DOM
const recipientTypeSelect = document.getElementById('recipientType');
const recipientSelect = document.getElementById('recipientSelect');
const addRecipientBtn = document.getElementById('addRecipient');
const selectedRecipients = document.getElementById('selectedRecipients');
const attachmentInput = document.getElementById('attachment');
const fileInfo = document.getElementById('fileInfo');
const whatsappForm = document.getElementById('whatsappForm');
const statusMessage = document.getElementById('statusMessage');
const loadContactsBtn = document.getElementById('loadContactsBtn');
const clearContactsBtn = document.getElementById('clearContactsBtn');
const importStatus = document.getElementById('importStatus');

// Carrega os contatos automaticamente quando a página é iniciada
document.addEventListener('DOMContentLoaded', async () => {
    if (SUPABASE_URL.includes('COLOQUE_A_URL') || SUPABASE_ANON_KEY.includes('COLOQUE_SUA_CHAVE')) {
        showImportStatus('⚠️ Configure suas credenciais do Supabase no arquivo main.js primeiro!', 'error');
        return;
    }
    await loadContactsFromSupabase();
});

// Carregar contatos do Supabase
async function loadContactsFromSupabase() {
    if (!supabase) {
        showImportStatus('Conecte-se ao Supabase primeiro.', 'error');
        return;
    }

    try {
        showImportStatus('🔄 Carregando contatos do Supabase...', 'info');

        // Carregar contatos
        const { data: contactsData, error: contactsError } = await supabase
            .from('whatsapp_contacts')
            .select('*')
            .order('name');

        // Carregar grupos
        const { data: groupsData, error: groupsError } = await supabase
            .from('whatsapp_groups')
            .select('*')
            .order('name');

        if (contactsError || groupsError) {
            throw new Error(contactsError?.message || groupsError?.message);
        }

        // Converter para formato local
        contacts = (contactsData || []).map(contact => ({
            id: 'db_' + contact.id,
            name: contact.name,
            number: contact.phone
        }));

        groups = (groupsData || []).map(group => ({
            id: 'db_' + group.id,
            name: group.name,
            number: group.group_id
        }));

        updateRecipientOptions();
        updateStats();

        showImportStatus(`✅ Carregados: ${contacts.length} contatos, ${groups.length} grupos`, 'success');

    } catch (error) {
        showImportStatus(`❌ Erro ao carregar: ${error.message}`, 'error');
    }
}

// Limpar todos os contatos
async function clearAllContacts() {
    if (!confirm('Tem certeza que deseja limpar todos os contatos e grupos?')) {
        return;
    }

    try {
        if (supabase) {
            showImportStatus('🔄 Limpando banco de dados...', 'info');

            await supabase.from('whatsapp_contacts').delete().neq('id', 0);
            await supabase.from('whatsapp_groups').delete().neq('id', 0);
        }

        contacts = [];
        groups = [];

        updateRecipientOptions();
        updateStats();

        showImportStatus('✅ Todos os contatos foram removidos!', 'success');
    } catch (error) {
        showImportStatus(`❌ Erro ao limpar: ${error.message}`, 'error');
    }
}

// Atualizar estatísticas
function updateStats() {
    document.getElementById('contactsCount').textContent = contacts.length;
    document.getElementById('groupsCount').textContent = groups.length;
    document.getElementById('totalCount').textContent = contacts.length + groups.length;
}

// Atualizar opções de destinatários
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

// Função para mostrar status de importação
function showImportStatus(message, type) {
    if (importStatus) {
        importStatus.textContent = message;
        importStatus.className = type;
    }
}

// Função para mostrar status geral
function showStatus(message, type) {
    if (statusMessage) {
        statusMessage.textContent = message;
        statusMessage.className = type;
    }
}

// Event Listeners
if (loadContactsBtn) {
    loadContactsBtn.addEventListener('click', loadContactsFromSupabase);
}
if (clearContactsBtn) {
    clearContactsBtn.addEventListener('click', clearAllContacts);
}

// Atualizar opções quando o tipo de destinatário muda
recipientTypeSelect.addEventListener('change', updateRecipientOptions);

// Mostrar informações do arquivo anexado
attachmentInput.addEventListener('change', function () {
    if (this.files.length > 0) {
        const file = this.files[0];
        fileInfo.textContent = `${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
    } else {
        fileInfo.textContent = '';
    }
});

// Adicionar destinatário
addRecipientBtn.addEventListener('click', function () {
    const selected = recipientSelect.options[recipientSelect.selectedIndex];

    if (selected.value) {
        const type = recipientTypeSelect.value;
        const label = type === 'contact' ? 'Contato' : 'Grupo';

        if (document.querySelector(`[data-id="${selected.value}"]`)) return;

        const recipientEl = document.createElement('span');
        recipientEl.className = 'recipient';
        recipientEl.dataset.id = selected.value;
        recipientEl.dataset.number = selected.dataset.number;
        recipientEl.innerHTML = `${label}: ${selected.textContent} <button type="button">&times;</button>`;

        recipientEl.querySelector('button').addEventListener('click', function () {
            recipientEl.remove();
        });

        selectedRecipients.appendChild(recipientEl);
    }
});

// Enviar formulário
whatsappForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const recipients = Array.from(selectedRecipients.querySelectorAll('.recipient')).map(el => ({
        id: el.dataset.id, // O backend não usa o ID, mas é bom manter para consistência
        number: el.dataset.number
    }));

    if (recipients.length === 0) {
        showStatus('Por favor, selecione pelo menos um destinatário.', 'error');
        return;
    }

    const message = document.getElementById('message').value.trim();
    if (!message && attachmentInput.files.length === 0) {
        showStatus('Por favor, digite uma mensagem ou anexe um arquivo.', 'error');
        return;
    }

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

    showStatus('Enviando/Agendando mensagem...', 'info');

    try {
        const response = await fetch(`${API_URL}/api/send-message`, {
            method: 'POST',
            body: formData,
            // Headers não são necessários para FormData, o browser os define automaticamente
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showStatus(result.message, 'success');
            whatsappForm.reset();
            selectedRecipients.innerHTML = '';
            fileInfo.textContent = '';
        } else {
            showStatus(`Erro: ${result.message || 'Ocorreu um erro no servidor.'}`, 'error');
        }
    } catch (error) {
        console.error('Erro ao enviar formulário:', error);
        showStatus('Erro de conexão com a API. Verifique se o servidor backend (api.js) está rodando.', 'error');
    }
});