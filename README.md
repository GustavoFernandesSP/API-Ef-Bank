Para rodar o código é necessário =
Adicionar o certificado .p12 dentro da pasta principal do projeto exemplo:
// Leitura do certificado .p12
const certificadoH = fs.readFileSync('./certificadoH.p12');
const certificadoP = fs.readFileSync('./certificadoP.p12');
Nesse trecho de código mostra o caminho e seu nome.

Instalar o PostgreesSQL para armazenar os txid.
Criação do banco/tabela: 

Create Database -
CREATE DATABASE pix_app;

Create Table - 
CREATE TABLE cobrancas (
    id integer NOT NULL DEFAULT nextval('cobrancas_id_seq'::regclass),
    usuario_id text NOT NULL,
    txid character varying(300) NOT NULL,
    criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cobrancas_pkey PRIMARY KEY (id),
    CONSTRAINT cobrancas_txid_key UNIQUE (txid)
);


!!!!!!!!!!!!!! Lembre de adicionar sempre o .env !!!!!!!!!!!!!!!!!!

CLIENT_ID=Client_Id_................................
CLIENT_SECRET=Client_Secret_.....................................

SENHA_BANCO=Senha_Do_Banco
CHAVE_PIX=suaChavePix
PORT=3000
