// app.js - Servidor Express para a API de envio de WhatsApp
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { scheduledJobs, scheduleJob } = require('node-schedule');
const axios = require('axios');
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
      await sendWhatsAppMessage(newMessage);
      newMessage.status = 'sent';
      
      res.status(200).json({
        success: true,
        message: 'Mensagem enviada com sucesso',
        data: newMessage
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
    // Em um ambiente real, aqui usaríamos a API oficial do WhatsApp Business
    // Exemplo de como seria com a API oficial:
    
    for (const recipient of messageData.recipients) {
      // Construir o payload da mensagem conforme documentação da API do WhatsApp
      const payload = {
        messaging_product: "whatsapp",
        to: recipient.number,
        type: "text",
        text: { body: messageData.message }
      };
      
      // Se houver anexo, precisamos primeiro fazer upload para o servidor do WhatsApp
      // e depois enviar uma mensagem de mídia em vez de texto
      if (messageData.attachment) {
        // Este código seria adaptado conforme o tipo de mídia
        // Aqui é apenas ilustrativo
        
        // 1. Upload da mídia para os servidores do WhatsApp
        // const mediaUploadResponse = await axios.post(
        //   `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`,
        //   mediaFormData,
        //   { headers: { Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}` } }
        // );
        
        // 2. Enviar mensagem com mídia
        // payload = {
        //   messaging_product: "whatsapp",
        //   to: recipient.number,
        //   type: "image",
        //   image: { id: mediaUploadResponse.data.id }
        // };
      }
      
      // Enviar a mensagem
      // Em um cenário real, descomente o código abaixo:
      
      // const response = await axios.post(
      //   `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      //   payload,
      //   { headers: { Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}` } }
      // );
      
      // Simular a resposta da API para desenvolvimento
      console.log(`Mensagem enviada para ${recipient.number}: ${messageData.message}`);
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao enviar mensagem via WhatsApp API:', error);
    throw error;
  }
}

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
