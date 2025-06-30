document.addEventListener('DOMContentLoaded', function () {
    // Dados iniciais (serão substituídos pelos dados importados)
    let contacts = [
        { id: 'c1', name: 'João Silva', number: '5511999990001' },
        { id: 'c2', name: 'Maria Oliveira', number: '5511999990002' },
        { id: 'c3', name: 'Carlos Santos', number: '5511999990003' }
    ];

    let groups = [
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

    // Elementos da importação
    const contactsFileInput = document.getElementById('contactsFile');
    const importContactsBtn = document.getElementById('importContactsBtn');
    const importStatus = document.getElementById('importStatus');

    // Função para importar contatos
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
    function processImportedData(data) {
        if (!data || data.length === 0) {
            showImportStatus('Arquivo vazio ou sem dados válidos.', 'error');
            return;
        }

        let importedContacts = [];
        let importedGroups = [];
        let errors = [];

        data.forEach((row, index) => {
            // Normalizar nomes das colunas (ignorar case e espaços)
            const normalizedRow = {};
            Object.keys(row).forEach(key => {
                const normalizedKey = key.toLowerCase().trim();
                normalizedRow[normalizedKey] = row[key];
            });

            // Buscar colunas de nome e telefone com diferentes variações
            const name = normalizedRow.nome || normalizedRow.name || normalizedRow.contato || '';
            const phone = normalizedRow.telefone || normalizedRow.phone || normalizedRow.numero || normalizedRow.whatsapp || '';
            const type = (normalizedRow.tipo || normalizedRow.type || 'contato').toLowerCase();

            if (!name || !phone) {
                errors.push(`Linha ${index + 1}: Nome ou telefone em branco`);
                return;
            }

            // Limpar e formatar número de telefone
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

        // Atualizar listas
        if (importedContacts.length > 0) {
            contacts = [...contacts, ...importedContacts];
        }
        if (importedGroups.length > 0) {
            groups = [...groups, ...importedGroups];
        }

        // Atualizar interface
        updateRecipientOptions();

        // Mostrar resultado
        let message = `✅ Importação concluída: ${importedContacts.length} contatos, ${importedGroups.length} grupos`;
        if (errors.length > 0) {
            message += `\n⚠️ ${errors.length} erros encontrados`;
            console.log('Erros na importação:', errors);
        }

        showImportStatus(message, importedContacts.length > 0 || importedGroups.length > 0 ? 'success' : 'error');

        // Limpar input
        contactsFileInput.value = '';
    }

    // Mostrar status da importação
    function showImportStatus(message, type) {
        importStatus.textContent = message;
        importStatus.className = type === 'success' ? 'success' : type === 'error' ? 'error' : '';

        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                importStatus.textContent = '';
                importStatus.className = '';
            }, 5000);
        }
    }

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
    attachmentInput.addEventListener('change', function () {
        if (this.files.length > 0) {
            const file = this.files[0];
            fileInfo.textContent = `${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
        } else {
            fileInfo.textContent = '';
        }
    });

    // Adicionar destinatário à lista de selecionados
    addRecipientBtn.addEventListener('click', function () {
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