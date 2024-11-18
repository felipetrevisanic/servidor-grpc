// servidor-grpc/servidor.js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const axios = require('axios');
const path = require('path');

// Carregar o arquivo .proto
const PROTO_PATH = path.join(__dirname, '..', 'moeda.proto');
const pacoteDefinicao = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
const moedaProto = grpc.loadPackageDefinition(pacoteDefinicao).moeda;

// Função para obter a taxa de câmbio
async function obterTaxaCambio(origem, destino) {
    try {
      const resposta = await axios.get(`https://economia.awesomeapi.com.br/last/${origem}-${destino}`);
      const dados = resposta.data;
      const par = `${origem}${destino}`;
      if (dados[par]) {
        return parseFloat(dados[par].bid);
      } else {
        throw new Error('Taxa de câmbio não encontrada para o par ${origem}-${destino}');
      }
    } catch (erro) {
      console.error(`Erro ao obter taxa de câmbio para ${origem}-${destino}:`, erro.message);
      throw erro;
    }
  }
  
  

// Implementação do método Converter
async function converter(chamada, callback) {
    const { valor, moeda_origem, moeda_destino } = chamada.request;
    console.log('Recebido pedido de conversão:', chamada.request);
  
    // Verificar se os campos não são undefined
    if (!valor || !moeda_origem || !moeda_destino) {
      console.error('Campos ausentes na requisição:', chamada.request);
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Campos ausentes na requisição',
      });
    }
  
    // Converter para maiúsculas
    const moedaOrigemUpper = moeda_origem.toUpperCase();
    const moedaDestinoUpper = moeda_destino.toUpperCase();
  
    try {
      const taxa = await obterTaxaCambio(moedaOrigemUpper, moedaDestinoUpper);
      const valorConvertido = valor * taxa;
      console.log('Taxa obtida:', taxa);
      callback(null, {
        valor_convertido: valorConvertido,
        moeda_origem: moedaOrigemUpper,
        moeda_destino: moedaDestinoUpper,
        taxa_cambio: taxa,
      });
    } catch (erro) {
      console.error('Erro ao converter moeda:', erro);
      callback({
        code: grpc.status.INTERNAL,
        message: erro.message,
      });
    }
  } 
// Iniciar o servidor gRPC
async function listarMoedas(call, callback) {
  try {
    const resposta = await axios.get('https://open.er-api.com/v6/latest');
    const currencies = resposta.data.rates;

    const moedasArray = Object.keys(currencies).map((code) => ({
      code,
      name: code, // Usando o código como nome por falta de dados completos
    }));

    console.log('Moedas processadas:', moedasArray);

    callback(null, { moedas: moedasArray });
  } catch (erro) {
    console.error('Erro ao obter a lista de moedas:', erro.message);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Erro ao obter a lista de moedas',
    });
  }
}

// Adicione o novo método ao servidor gRPC
function main() {
  const servidor = new grpc.Server();
  servidor.addService(moedaProto.ConversorDeMoedas.service, {
    Converter: converter,
    ListarMoedas: listarMoedas,
  });
  servidor.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
    console.log('Servidor gRPC rodando na porta 50051');
    servidor.start();
  });
}

main();
