const express = require('express');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');

const {
  AREA_LABELS,
  CURSOS,
  PERIODOS,
  COMPORTAMENTAL,
  TECNICA,
  IA_FAMILIARIDADE,
  questionarioPublico,
} = require('./questions');
const { calcularResultado, AREAS } = require('./scoring');
const { criarRepositorio } = require('./db');

const app = express();
const repositorio = criarRepositorio();

// Versão do Aviso de Privacidade vigente — gravada junto com o consentimento como
// prova (art. 8º, §2º). Ao alterar o texto de /privacidade, incremente aqui.
const AVISO_VERSAO = 'v1-2026-08';

app.set('trust proxy', true);
app.use(express.json());

// ---------------------------------------------------------------------------
// Proteção opcional da área de relatórios: sem ADMIN_PASSWORD tudo fica aberto
// (decisão do projeto); definindo a variável no Railway, /admin e /api/relatorio
// passam a exigir a senha, sem alteração de código.
// ---------------------------------------------------------------------------
const senhasConferem = (informada, senha) =>
  crypto.timingSafeEqual(
    crypto.createHash('sha256').update(String(informada)).digest(),
    crypto.createHash('sha256').update(String(senha)).digest()
  );

// Só senhas erradas contam para o limite (o 401 inicial sem credencial, que faz o
// navegador abrir o prompt, não conta — vários alunos podem dividir o mesmo IP).
const tentativasAuth = new Map();
const LIMITE_TENTATIVAS = 20;
const JANELA_TENTATIVAS_MS = 15 * 60 * 1000;

function protegerRelatorio(req, res, next) {
  const senha = process.env.ADMIN_PASSWORD;
  if (!senha) return next();

  const ip = req.ip || 'desconhecido';
  const agora = Date.now();
  const registro = tentativasAuth.get(ip);
  if (registro && agora < registro.resetEm && registro.falhas >= LIMITE_TENTATIVAS) {
    return res.status(429).send('Muitas tentativas de senha. Tente novamente em alguns minutos.');
  }

  const auth = req.headers.authorization || '';
  let tentouSenha = false;
  if (auth.startsWith('Basic ')) {
    tentouSenha = true;
    const decodificado = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    const informada = decodificado.slice(decodificado.indexOf(':') + 1);
    if (senhasConferem(informada, senha)) {
      tentativasAuth.delete(ip);
      return next();
    }
  }

  if (tentouSenha) {
    const atual =
      registro && agora < registro.resetEm
        ? registro
        : { falhas: 0, resetEm: agora + JANELA_TENTATIVAS_MS };
    atual.falhas += 1;
    tentativasAuth.set(ip, atual);
  }
  res.set('WWW-Authenticate', 'Basic realm="Relatorios FMX Academy"');
  res.status(401).send('Autenticação necessária.');
}

// Atenção: o prefixo de app.use só casa em fronteira de '/', então rotas com
// sufixo ('.html', '.csv') precisam estar listadas explicitamente.
app.use(['/admin', '/admin.html'], protegerRelatorio);
app.use(['/api/relatorio', '/api/relatorio.csv'], protegerRelatorio);
app.use('/api/qrcode', protegerRelatorio);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/privacidade', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacidade.html'));
});

// ---------------------------------------------------------------------------
// Questionário (versão pública, sem gabarito)
// ---------------------------------------------------------------------------
app.get('/api/questionario', (_req, res) => {
  res.json(questionarioPublico());
});

// ---------------------------------------------------------------------------
// Validação do envio
// ---------------------------------------------------------------------------
// Canoniza para DDD + número: remove tudo que não é dígito e descarta o DDI 55
// quando presente (12-13 dígitos), para que "+55 11 91234-5678" e "(11) 91234-5678"
// virem a mesma chave na trava de duplicados. Com 10-11 dígitos o prefixo 55 é
// preservado — pode ser o DDD 55 (região de Santa Maria/RS).
function normalizarWhatsapp(texto) {
  let digitos = String(texto).replace(/\D/g, '');
  if (digitos.length >= 12 && digitos.startsWith('55')) digitos = digitos.slice(2);
  return digitos;
}

function validarEnvio(body) {
  if (!body || typeof body !== 'object') return { erro: 'Envio inválido.' };
  const id = body.identificacao;
  if (!id || typeof id !== 'object') return { erro: 'Dados de identificação ausentes.' };

  const nome = String(id.nome ?? '').trim();
  if (nome.length < 2 || nome.length > 120) return { erro: 'Informe seu nome completo.' };

  const curso = String(id.curso ?? '');
  if (!CURSOS.includes(curso)) return { erro: 'Selecione um curso válido.' };
  let cursoOutro = null;
  if (curso === 'Outro') {
    cursoOutro = String(id.cursoOutro ?? '').trim();
    if (!cursoOutro || cursoOutro.length > 120) return { erro: 'Especifique qual é o seu curso.' };
  }

  const periodo = String(id.periodo ?? '');
  if (!PERIODOS.includes(periodo)) return { erro: 'Selecione um período válido.' };

  // Consentimento LGPD é obrigatório para o tratamento (art. 7º, I / art. 8º).
  if (body.consentimento?.aceito !== true) {
    return { erro: 'É necessário ler e aceitar o Aviso de Privacidade para enviar suas respostas.' };
  }

  const whatsapp = String(id.whatsapp ?? '').trim();
  const whatsappNorm = normalizarWhatsapp(whatsapp);
  if (whatsappNorm.length < 10 || whatsappNorm.length > 11) {
    return { erro: 'Informe seu WhatsApp com DDD + número (ex.: 11 91234-5678) — é por ele que daremos o retorno.' };
  }

  const blocos = [
    ['comportamental', COMPORTAMENTAL],
    ['tecnica', TECNICA],
    ['ia', IA_FAMILIARIDADE],
  ];
  const respostas = {};
  for (const [chave, perguntas] of blocos) {
    const bloco = body[chave];
    if (!bloco || typeof bloco !== 'object') return { erro: 'Há perguntas sem resposta.' };
    respostas[chave] = {};
    for (const pergunta of perguntas) {
      const alternativa = bloco[pergunta.id];
      // typeof string: um array como ['b'] passaria no hasOwnProperty por coerção,
      // mas falharia na comparação estrita do scoring, corrompendo a pontuação.
      if (
        typeof alternativa !== 'string' ||
        !Object.prototype.hasOwnProperty.call(pergunta.opcoes, alternativa)
      ) {
        return { erro: 'Há perguntas sem resposta. Revise e envie novamente.' };
      }
      respostas[chave][pergunta.id] = alternativa;
    }
  }

  return {
    dados: { nome, curso, cursoOutro, periodo, whatsapp, whatsappNorm, respostas },
  };
}

// ---------------------------------------------------------------------------
// Recebimento das respostas
// ---------------------------------------------------------------------------
app.post('/api/respostas', async (req, res) => {
  try {
    const { erro, dados } = validarEnvio(req.body);
    if (erro) return res.status(400).json({ erro });

    const respostaDuplicada = () =>
      res.status(409).json({
        erro: 'Já recebemos uma resposta com este WhatsApp. Se acha que houve um engano, procure a equipe da FMX Academy.',
      });

    if (await repositorio.existeContato(dados.whatsappNorm)) {
      return respostaDuplicada();
    }

    const resultado = calcularResultado(dados.respostas);
    try {
      await repositorio.inserir({
        nome: dados.nome,
        curso: dados.curso,
        cursoOutro: dados.cursoOutro,
        periodo: dados.periodo,
        whatsapp: dados.whatsapp,
        whatsappNorm: dados.whatsappNorm,
        respostas: dados.respostas,
        scores: resultado.scores,
        perfil: resultado.perfil,
        indiceIA: resultado.indiceIA,
        acertouLimitacoesIA: resultado.acertouLimitacoesIA,
        // Prova do consentimento: a versão do aviso e o IP são definidos pelo
        // servidor (não confiamos no cliente); o horário é gravado no INSERT.
        consentimentoAceito: true,
        consentimentoVersao: AVISO_VERSAO,
        consentimentoIp: req.ip || null,
      });
    } catch (err) {
      // Corrida entre existeContato e inserir: o índice UNIQUE do banco decide.
      if (err.duplicado) return respostaDuplicada();
      throw err;
    }

    res.status(201).json({ card: resultado.card, perfil: resultado.perfil });
  } catch (err) {
    console.error('Erro ao salvar resposta:', err);
    res.status(500).json({ erro: 'Não foi possível salvar suas respostas. Tente novamente.' });
  }
});

// ---------------------------------------------------------------------------
// Relatório e estatísticas
// ---------------------------------------------------------------------------
// As estatísticas consideram apenas respostas ATIVAS; as desativadas continuam
// listadas na tabela e no CSV, marcadas, mas fora de todos os cálculos.
function agregarRelatorio(todos) {
  const registros = todos.filter((r) => r.ativo);
  const porPerfil = {};
  for (const chave of [...AREAS, 'hibrido']) porPerfil[chave] = 0;
  const porCurso = {};
  const porPeriodo = {};
  const distribuicaoIndiceIA = Array.from({ length: 7 }, () => 0);
  const acertosTecnicos = {};
  for (const area of AREAS) acertosTecnicos[area] = 0;
  let somaIndiceIA = 0;
  let acertouLimitacoes = 0;

  for (const r of registros) {
    porPerfil[r.perfil] = (porPerfil[r.perfil] ?? 0) + 1;
    const curso = r.curso === 'Outro' && r.cursoOutro ? `Outro: ${r.cursoOutro}` : r.curso;
    porCurso[curso] = (porCurso[curso] ?? 0) + 1;
    porPeriodo[r.periodo] = (porPeriodo[r.periodo] ?? 0) + 1;
    distribuicaoIndiceIA[r.indiceIA] += 1;
    somaIndiceIA += r.indiceIA;
    if (r.acertouLimitacoesIA) acertouLimitacoes += 1;
    for (const area of AREAS) acertosTecnicos[area] += r.scores[area].tecnicoAcertos;
  }

  const total = registros.length;
  const pctAcertoTecnico = {};
  for (const area of AREAS) {
    pctAcertoTecnico[area] = total ? (acertosTecnicos[area] / (total * 2)) * 100 : 0;
  }

  return {
    total,
    totalInativas: todos.length - registros.length,
    porPerfil,
    porCurso,
    porPeriodo,
    pctAcertoTecnico,
    distribuicaoIndiceIA,
    mediaIndiceIA: total ? somaIndiceIA / total : 0,
    pctAcertouLimitacoesIA: total ? (acertouLimitacoes / total) * 100 : 0,
    areas: AREA_LABELS,
  };
}

app.get('/api/relatorio', async (_req, res) => {
  try {
    const registros = await repositorio.listar();
    const candidatos = registros
      .slice()
      .reverse()
      .map((r) => ({
        id: r.id,
        nome: r.nome,
        curso: r.curso === 'Outro' && r.cursoOutro ? `Outro: ${r.cursoOutro}` : r.curso,
        periodo: r.periodo,
        whatsapp: r.whatsapp,
        perfil: r.perfil,
        scores: r.scores,
        indiceIA: r.indiceIA,
        ativo: r.ativo,
        criadoEm: r.criadoEm,
      }));
    res.json({ ...agregarRelatorio(registros), candidatos });
  } catch (err) {
    console.error('Erro ao montar relatório:', err);
    res.status(500).json({ erro: 'Não foi possível carregar o relatório.' });
  }
});

// Ativa/desativa uma resposta. Desativada, ela sai de todos os cálculos e o
// WhatsApp fica liberado para responder novamente. (Rota sob /api/relatorio,
// portanto coberta pela proteção de senha quando ADMIN_PASSWORD está definida.)
app.patch('/api/relatorio/respostas/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ativo = req.body?.ativo;
    if (!Number.isInteger(id) || id < 1 || typeof ativo !== 'boolean') {
      return res.status(400).json({ erro: 'Requisição inválida.' });
    }
    const encontrada = await repositorio.definirAtivo(id, ativo);
    if (!encontrada) return res.status(404).json({ erro: 'Resposta não encontrada.' });
    res.json({ id, ativo });
  } catch (err) {
    if (err.duplicado) {
      return res.status(409).json({
        erro: 'Este WhatsApp já tem outra resposta ativa. Desative a outra antes de reativar esta.',
      });
    }
    console.error('Erro ao atualizar resposta:', err);
    res.status(500).json({ erro: 'Não foi possível atualizar a resposta.' });
  }
});

// Exportação CSV para tabulação (separador ";" e BOM para abrir direto no Excel pt-BR)
app.get('/api/relatorio.csv', async (_req, res) => {
  try {
    const registros = await repositorio.listar();
    const campo = (v) => {
      let texto = v === null || v === undefined ? '' : String(v);
      // Neutraliza injeção de fórmula (CWE-1236): o Excel avalia células que começam
      // com = + - @ ou tab/CR mesmo entre aspas de CSV; o apóstrofo força texto puro.
      if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
      return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
    };
    const numero = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

    const cabecalho = [
      'id', 'data', 'nome', 'curso', 'curso_outro', 'periodo', 'whatsapp', 'perfil', 'ativo',
      'consentimento', 'consentimento_versao', 'consentimento_em', 'consentimento_ip',
      ...AREAS.flatMap((a) => [`${a}_total`, `${a}_tecnico`, `${a}_comportamental`]),
      'indice_ia', 'acertou_limitacoes_ia',
      ...COMPORTAMENTAL.map((q) => q.id),
      ...TECNICA.map((q) => q.id),
      ...IA_FAMILIARIDADE.map((q) => q.id),
    ];

    const linhas = registros.map((r) =>
      [
        r.id,
        new Date(r.criadoEm).toISOString(),
        r.nome,
        r.curso,
        r.cursoOutro ?? '',
        r.periodo,
        r.whatsapp,
        r.perfil,
        r.ativo ? 'sim' : 'nao',
        r.consentimentoAceito ? 'sim' : 'nao',
        r.consentimentoVersao ?? '',
        r.consentimentoEm ? new Date(r.consentimentoEm).toISOString() : '',
        r.consentimentoIp ?? '',
        ...AREAS.flatMap((a) => [
          numero(r.scores[a].total),
          numero(r.scores[a].tecnico),
          numero(r.scores[a].comportamental),
        ]),
        r.indiceIA,
        r.acertouLimitacoesIA ? 'sim' : 'nao',
        ...COMPORTAMENTAL.map((q) => r.respostas.comportamental[q.id]),
        ...TECNICA.map((q) => r.respostas.tecnica[q.id]),
        ...IA_FAMILIARIDADE.map((q) => r.respostas.ia[q.id]),
      ]
        .map(campo)
        .join(';')
    );

    const csv = '﻿' + [cabecalho.join(';'), ...linhas].join('\r\n');
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="tabulacao-fmxacademy.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Erro ao exportar CSV:', err);
    res.status(500).send('Não foi possível exportar o CSV.');
  }
});

// ---------------------------------------------------------------------------
// QR Code apontando para a URL pública do questionário
// ---------------------------------------------------------------------------
app.get('/api/qrcode', async (req, res) => {
  try {
    const base =
      process.env.PUBLIC_URL ||
      (process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : `${req.protocol}://${req.get('host')}`);
    const url = base.replace(/\/$/, '');
    const dataUrl = await QRCode.toDataURL(url, { width: 560, margin: 2 });
    res.json({ url, dataUrl });
  } catch (err) {
    console.error('Erro ao gerar QR Code:', err);
    res.status(500).json({ erro: 'Não foi possível gerar o QR Code.' });
  }
});

// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;

repositorio
  .iniciar()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor no ar em http://localhost:${PORT} (banco: ${repositorio.tipo})`);
    });
  })
  .catch((err) => {
    console.error('Falha ao preparar o banco de dados:', err);
    process.exit(1);
  });
