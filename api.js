// app.js - Servidor Express para a API de envio de WhatsApp
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { scheduledJobs, scheduleJob } = require('node-schedule');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configuração para upload de arquivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Banco de dados simulado (em um projeto real usaríamos MongoDB, PostgreSQL, etc)
const db = {
  contacts: [
    { id: 'c1', name: 'João Silva', number: '5511999990001' },
    { id: 'c2', name: 'Maria Oliveira', number: '5511999990002' },
    { id: 'c3', name: 'Carlos Santos', number: '5511999990003' }
  ],
  groups: [
    { id: 'g1', name: 'Família', number: 'group1' },
    { id: 'g2', name: 'Trabalho', number: 'group2' },
    { id: 'g3', name: 'Amigos', number: 'group3' }
  ],
  messages: []
};

// Rotas da API

// Obter contatos
app.get('/api/contacts', (req, res) => {
  res.json(db.contacts);
});

// Obter grupos
app.get('/api/groups', (req, res) => {
  res.json(db.groups);
});

// Enviar mensagem
app.post('/api/send-message', upload.single('attachment'), async (req, res) => {
  try {
    const { message, recipients, scheduleTime } = req.body;
    const recipientsList = JSON.parse(recipients);

    const newMessage = {
      id: Date.now().toString(),
      message,
      recipients: recipientsList,
      attachment: req.file ? req.file.path : null,
      scheduleTime: scheduleTime || null,
      status: 'pending',
      createdAt: new Date()
    };

    db.messages.push(newMessage);

    if (scheduleTime) {
      // Agendar envio
      scheduleJob(newMessage.id, new Date(scheduleTime), async () => {
        await sendWhatsAppMessage(newMessage);
        const index = db.messages.findIndex(msg => msg.id === newMessage.id);
        if (index !== -1) {
          db.messages[index].status = 'sent';
        }
      });

      res.status(201).json({
        success: true,
        message: 'Mensagem agendada com sucesso',
        data: newMessage
      });
    } else {
      // Enviar imediatamente
      const results = await sendWhatsAppMessage(newMessage);
      newMessage.status = 'sent';
      newMessage.results = results;

      res.status(200).json({
        success: true,
        message: 'Mensagem enviada com sucesso',
        data: newMessage,
        results: results
      });
    }
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar mensagem',
      error: error.message
    });
  }
});

// Obter histórico de mensagens
app.get('/api/messages', (req, res) => {
  res.json(db.messages);
});

// Cancelar mensagem agendada
app.delete('/api/messages/:id', (req, res) => {
  const { id } = req.params;

  const index = db.messages.findIndex(msg => msg.id === id);
  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: 'Mensagem não encontrada'
    });
  }

  // Cancelar agendamento
  if (scheduledJobs[id]) {
    scheduledJobs[id].cancel();
  }

  // Atualizar status
  db.messages[index].status = 'cancelled';

  res.json({
    success: true,
    message: 'Agendamento cancelado com sucesso',
    data: db.messages[index]
  });
});

// Função para enviar mensagem pelo WhatsApp Business API
async function sendWhatsAppMessage(messageData) {
  try {
    const results = [];

    for (const recipient of messageData.recipients) {
      let payload;
      let mediaId = null;

      // Se houver anexo, primeiro fazer upload da mídia
      if (messageData.attachment) {
        try {
          mediaId = await uploadMediaToWhatsApp(messageData.attachment);
        } catch (error) {
          console.error('Erro ao fazer upload da mídia:', error);
          // Continuar sem anexo se o upload falhar
        }
      }

      // Construir o payload baseado no tipo de conteúdo
      if (mediaId) {
        // Determinar o tipo de mídia baseado na extensão do arquivo
        const fileExtension = messageData.attachment.split('.').pop().toLowerCase();
        let mediaType = 'document'; // padrão

        if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension)) {
          mediaType = 'image';
        } else if (['mp4', 'avi', 'mov'].includes(fileExtension)) {
          mediaType = 'video';
        } else if (['mp3', 'wav', 'ogg'].includes(fileExtension)) {
          mediaType = 'audio';
        }

        payload = {
          messaging_product: "whatsapp",
          to: recipient.number,
          type: mediaType,
          [mediaType]: {
            id: mediaId,
            caption: messageData.message // Mensagem como legenda da mídia
          }
        };
      } else {
        // Mensagem apenas de texto
        payload = {
          messaging_product: "whatsapp",
          to: recipient.number,
          type: "text",
          text: { body: messageData.message }
        };
      }

      // Enviar a mensagem para a API do WhatsApp
      const response = await axios.post(
        `https://graph.facebook.com/${process.env.WHATSAPP_VERSION || 'v18.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      results.push({
        recipient: recipient.number,
        success: true,
        messageId: response.data.messages[0].id,
        response: response.data
      });

      console.log(`✅ Mensagem enviada para ${recipient.number} - ID: ${response.data.messages[0].id}`);

      // Pequeno delay entre mensagens para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem via WhatsApp API:', error.response?.data || error.message);
    throw error;
  }
}

// Função para fazer upload de mídia para o WhatsApp
async function uploadMediaToWhatsApp(filePath) {
  try {
    const fs = require('fs');
    const FormData = require('form-data');

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('messaging_product', 'whatsapp');

    const response = await axios.post(
      `https://graph.facebook.com/${process.env.WHATSAPP_VERSION || 'v18.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`
        }
      }
    );

    console.log('✅ Upload de mídia realizado - ID:', response.data.id);
    return response.data.id;
  } catch (error) {
    console.error('❌ Erro no upload de mídia:', error.response?.data || error.message);
    throw error;
  }
}

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});