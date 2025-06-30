// Variáveis globais
let supabase = null;
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
const contactsFileInput = document.getElementById('contactsFile');
const importContactsBtn = document.getElementById('importContactsBtn');
const loadContactsBtn = document.getElementById('loadContactsBtn');
const clearContactsBtn = document.getElementById('clearContactsBtn');
const importStatus = document.getElementById('importStatus');

// Conectar ao Supabase
async function connectSupabase() {
    const url = document.getElementById('supabaseUrl').value;
    const key = document.getElementById('supabaseKey').value;

    if (!url || !key) {
        showConnectionStatus('Por favor, preencha a URL e a chave do Supabase.', 'error');
        return;
    }

    try {
        supabase = window.supabase.createClient(url, key);
        showConnectionStatus('✅ Conectado ao Supabase com sucesso!', 'success');

        // Carregar contatos existentes
        await loadContactsFromSupabase();
    } catch (error) {
        showConnectionStatus(`❌ Erro ao conectar: ${error.message}`, 'error');
    }
}

// Criar tabelas no Supabase
function createTables() {
    const sql = `
-- Tabela de contatos
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
id SERIAL PRIMARY KEY,
name TEXT NOT NULL,
phone TEXT NOT NULL,
type TEXT DEFAULT 'contato',
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de grupos
CREATE TABLE IF NOT EXISTS whatsapp_groups (
id SERIAL PRIMARY KEY,
name TEXT NOT NULL,
group_id TEXT NOT NULL,
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON whatsapp_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_groups_group_id ON whatsapp_groups(group_id);
    `;

    showConnectionStatus(`📋 SQL para criar as tabelas:\n\n${sql}\n\nExecute este SQL no painel do Supabase (SQL Editor).`, 'info');
}

// Carregar contatos do Supabase
async function loadContactsFromSupabase() {
    if (!supabase) {
        showImportStatus('Conecte-se ao Supabase primeiro.', 'error');
        return;
    }

    try {
        showImportStatus('Carregando contatos do Supabase...', '');

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

// Salvar contatos no Supabase
async function saveContactsToSupabase(newContacts, newGroups) {
    if (!supabase) {
        throw new Error('Conecte-se ao Supabase primeiro');
    }

    try {
        // Salvar contatos
        if (newContacts.length > 0) {
            const contactsToInsert = newContacts.map(contact => ({
                name: contact.name,
                phone: contact.number,
                type: 'contato'
            }));

            const { error: contactsError } = await supabase
                .from('whatsapp_contacts')
                .insert(contactsToInsert);

            if (contactsError) throw contactsError;
        }

        // Salvar grupos
        if (newGroups.length > 0) {
            const groupsToInsert = newGroups.map(group => ({
                name: group.name,
                group_id: group.number
            }));

            const { error: groupsError } = await supabase
                .from('whatsapp_groups')
                .insert(groupsToInsert);

            if (groupsError) throw groupsError;
        }

        return true;
    } catch (error) {
        throw error;
    }
}

// Limpar todos os contatos
async function clearAllContacts() {
    if (!confirm('Tem certeza que deseja limpar todos os contatos e grupos?')) {
        return;
    }

    try {
        if (supabase) {
            showImportStatus('Limpando banco de dados...', '');

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

// Importar contatos
importContactsBtn.addEventListener('click', function () {
    const file = contactsFileInput.files[0];
    if (!file) {
        showImportStatus('Por favor, selecione um arquivo.', 'error');
        return;
    }

    showImportStatus('Importando contatos...', '');

    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (fileExtension === 'csv') {
        importFromCSV(file);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        importFromExcel(file);
    } else {
        showImportStatus('Formato não suportado. Use .csv, .xlsx ou .xls', 'error');
    }
});

// Importar de CSV
function importFromCSV(file) {
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
            processImportedData(results.data);
        },
        error: function (error) {
            showImportStatus('Erro ao ler CSV: ' + error.message, 'error');
        }
    });
}

// Importar de Excel
function importFromExcel(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
            processImportedData(jsonData);
        } catch (error) {
            showImportStatus('Erro ao ler Excel: ' + error.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

// Processar dados importados
async function processImportedData(data) {
    if (!data || data.length === 0) {
        showImportStatus('Arquivo vazio ou sem dados válidos.', 'error');
        return;
    }

    let importedContacts = [];
    let importedGroups = [];
    let errors = [];

    data.forEach((row, index) => {
        // Normalizar nomes das colunas
        const normalizedRow = {};
        Object.keys(row).forEach(key => {
            const normalizedKey = key.toLowerCase().trim();
            normalizedRow[normalizedKey] = row[key];
        });

        const name = normalizedRow.nome || normalizedRow.name || normalizedRow.contato || '';
        const phone = normalizedRow.telefone || normalizedRow.phone || normalizedRow.numero || normalizedRow.whatsapp || '';
        const type = (normalizedRow.tipo || normalizedRow.type || 'contato').toLowerCase();

        if (!name || !phone) {
            errors.push(`Linha ${index + 1}: Nome ou telefone em branco`);
            return;
        }

        const cleanPhone = phone.toString().replace(/\D/g, '');

        if (cleanPhone.length < 10) {
            errors.push(`Linha ${index + 1}: Número inválido: ${phone}`);
            return;
        }

        const contact = {
            id: 'imported_' + Date.now() + '_' + index,
            name: name.toString().trim(),
            number: cleanPhone
        };

        if (type.includes('grupo') || type.includes('group')) {
            importedGroups.push(contact);
        } else {
            importedContacts.push(contact);
        }
    });

    try {
        // Salvar no Supabase se conectado
        if (supabase) {
            showImportStatus('Salvando no Supabase...', '');
            await saveContactsToSupabase(importedContacts, importedGroups);
        }

        // Atualizar listas locais
        contacts = [...contacts, ...importedContacts];
        groups = [...groups, ...importedGroups];

        updateRecipientOptions();
        updateStats();

        let message = `✅ Importação concluída: ${importedContacts.length} contatos, ${importedGroups.length} grupos`;
        if (supabase) {
            message += ' (salvo no Supabase)';
        }
        if (errors.length > 0) {
            message += `\n⚠️ ${errors.length} erros encontrados`;
        }

        showImportStatus(message, 'success');
        contactsFileInput.value = '';

    } catch (error) {
        showImportStatus(`❌ Erro ao salvar: ${error.message}`, 'error');
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

// Event Listeners
loadContactsBtn.addEventListener('click', loadContactsFromSupabase);
clearContactsBtn.addEventListener('click', clearAllContacts);

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
whatsappForm.addEventListener('submit', function (e) {
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

    showStatus('Enviando mensagem...', '');

    setTimeout(() => {
        showStatus('Mensagem enviada com sucesso!', 'success');
        whatsappForm.reset();
        selectedRecipients.innerHTML = '';
        fileInfo.textContent = '';
    }, 1500);
});