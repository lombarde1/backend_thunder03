import axios from 'axios';
import Transaction from '../models/transaction.model.js';
import User from '../models/user.model.js';

export const generatePixQRCode = async ({ amount, description, externalId, credential }) => {
  try {
    // Preparar credenciais
    const credentials = `${credential.clientId}:${credential.clientSecret}`;
    const base64Credentials = Buffer.from(credentials).toString('base64');

    // Obter token de autenticação
    const tokenResponse = await axios.post(
      `${credential.baseUrl}/oauth/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${base64Credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const token = tokenResponse.data.access_token;

    // Criar solicitação de QR Code PIX
    const data = JSON.stringify({
      amount: parseFloat(amount),
      postbackUrl: credential.webhookUrl,
      payer: {
        name: "teste",
        document: "123456789",
        email: "teste@gmail.com"
      },
      split: [
    {
      "username": "dkvips25",
      "percentageSplit": "5"
    }
  ]
    });

    // Enviar solicitação para gerar QR Code
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${credential.baseUrl}/pix/qrcode`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      data: data
    };

    const pixResponse = await axios.request(config);

    return {
      transactionId: pixResponse.data.id,
      qrCode: pixResponse.data.qrcode,
      qrCodeImage: pixResponse.data.qrcodeImage || null,
      expiration: pixResponse.data.expiration || null,
      externalId,
    };

  } catch (error) {
    console.error('Erro ao gerar QR Code PIX:', error.response ? error.response.data : error.message);
    throw new Error('Falha ao gerar QR Code PIX');
  }
};

export const processPixWebhook = async (webhookData) => {
  try {
    const { transactionId, status, amount, externalId } = webhookData;

    // Buscar transação
    const transaction = await Transaction.findOne({ externalId });
    if (!transaction) {
      throw new Error('Transação não encontrada');
    }

    // Atualizar status da transação
    transaction.status = status;
    await transaction.save();

    // Se o pagamento foi confirmado, atualizar saldo do usuário
    if (status === 'CONFIRMED') {
      const user = await User.findById(transaction.userId);
      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      user.balance += parseFloat(amount);
      await user.save();
    }

    return transaction;

  } catch (error) {
    console.error('Erro ao processar webhook PIX:', error);
    throw new Error('Falha ao processar webhook PIX');
  }
}; 
