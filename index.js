require('dotenv').config();
const { Pool } = require('pg');
const express = require('express');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const QRCode = require('qrcode');


const app = express();
app.use(express.json());


app.use(express.static('public'));

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'pix_app',
  password: process.env.SENHA_BANCO,
  port: 5432, // padrão do PostgreSQL
});

pool.query('SELECT current_database();')
  .then(res => console.log('🔗 Banco conectado:', res.rows[0].current_database))
  .catch(err => console.error('Erro ao conectar no banco:', err.message));



// Leitura do certificado .p12
const certificadoH = fs.readFileSync('./certificadoH.p12');
const certificadoP = fs.readFileSync('./certificadoP.p12');

// Agent HTTPS com mTLS
const httpsAgent = new https.Agent({
  pfx: certificadoP,
  passphrase: '' // deixe vazio se o .p12 não tiver senha
});

// Função para obter token da Efí
async function obterToken() {
  const auth = Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString('base64');

  const response = await axios({
    method: 'post',
    url: 'https://pix.api.efipay.com.br/oauth/token',
    headers: {
      Authorization: 'Basic ' + auth,
      'Content-Type': 'application/json'
    },
    data: {
      grant_type: 'client_credentials'
    },
    httpsAgent
  });

  return response.data.access_token;
}




async function salvarCobranca(usuarioId, txid) {
  try {
    const query = 'INSERT INTO cobrancas (usuario_id, txid) VALUES ($1, $2) RETURNING *';
    const values = [usuarioId, txid];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (err) {
    console.error('Erro ao salvar cobrança:', err.message);
    throw err;
  }
}



// Rotas



// Rota para gerar cobrança Pix
app.post('/pix', async (req, res) => {
  try {
    const { nome, cpf, valor } = req.body;
    const accessToken = await obterToken();

    

    const pixResponse = await axios({
      method: 'POST',
      // url: `https://pix-h.api.efipay.com.br/v2/cob/${txid}`,
      url: `https://pix.api.efipay.com.br/v2/cob`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        calendario: { expiracao: 8600 },
        devedor: { nome, cpf },
        valor: { original: valor },
        chave: process.env.CHAVE_PIX,
        solicitacaoPagador: 'Pagamento via MicroService de cobrança',
      },
      httpsAgent
    });

    const { loc, pixCopiaECola, txid: respostaTxid } = pixResponse.data;
    const  respostaTxid2  = pixResponse.data.txid;

    console.log(respostaTxid2);
    salvarCobranca(req.body.usuarioId, respostaTxid2); 

    res.json({
      txid: respostaTxid,
      pixCopiaECola,
      qrCodeImageUrl: `https://${loc.location}`
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ erro: 'Erro ao gerar cobrança Pix' });
  }
});





app.post('/GerarImagePix', async (req, res) => {
    const { pixCopiaECola } = req.body;
  
    if (typeof pixCopiaECola !== 'string' || pixCopiaECola.trim() === '') {
      return res.status(400).json({ erro: 'pixCopiaECola inválido ou ausente' });
    }
  
    try {
      const qrCodeBase64 = await QRCode.toDataURL(pixCopiaECola);
      return res.json({ qrCodeImageBase64: qrCodeBase64 });
    } catch (err) {
      console.error('Erro ao gerar QR Code:', err);
      return res.status(500).json({ erro: 'Erro ao gerar QR Code' });
    }
  });



  app.post('/ConsultarCobrancas', async (req, res) => {
    const { usuarioId } = req.body;
    
    if (!usuarioId) {
      return res.status(400).json({ erro: 'usuarioId é obrigatório' });
    }
  
    try {
      const query = `
        SELECT txid
        FROM cobrancas
        WHERE usuario_id = $1
        ORDER BY criado_em DESC
        LIMIT 1
      `;
  
      const resultado = await pool.query(query, [usuarioId]);
  
      if (resultado.rows.length === 0) {
        return res.status(404).json({ mensagem: 'Nenhuma cobrança encontrada para este usuário.' });
      }

      const txid = resultado.rows[0].txid;
      
      const accessToken = await obterToken();
      const ConsultaPixResponse = await axios({
        method: 'GET',
        url: `https://pix.api.efipay.com.br/v2/cob/${txid}`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        httpsAgent
      });
  
      const  Status  = ConsultaPixResponse.data.status;
  
      console.log(Status);
  
      res.json({
        txid: txid,
        status: Status
      });


    } catch (erro) {
      console.error('Erro ao consultar cobranças:', erro);
      res.status(500).json({ erro: 'Erro interno do servidor' });
    }
  });
  



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});




