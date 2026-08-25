// Camada de persistência. Com DATABASE_URL definida (Railway) usa PostgreSQL;
// sem ela, usa um repositório em memória para desenvolvimento local
// (os dados são perdidos ao reiniciar o servidor).

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS respostas (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    curso TEXT NOT NULL,
    curso_outro TEXT,
    periodo TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    whatsapp_norm TEXT NOT NULL,
    respostas JSONB NOT NULL,
    scores JSONB NOT NULL,
    perfil TEXT NOT NULL,
    indice_ia INTEGER NOT NULL,
    acertou_limitacoes_ia BOOLEAN NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    consentimento_aceito BOOLEAN NOT NULL DEFAULT false,
    consentimento_versao TEXT,
    consentimento_ip TEXT,
    consentimento_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

// Migrações idempotentes, executadas a cada inicialização.
// O índice UNIQUE fecha a janela de corrida do check-then-insert da aplicação;
// ele é parcial (só respostas ativas) para que desativar uma resposta libere o
// WhatsApp para responder novamente.
const MIGRACOES = [
  `ALTER TABLE respostas ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE respostas ADD COLUMN IF NOT EXISTS consentimento_aceito BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE respostas ADD COLUMN IF NOT EXISTS consentimento_versao TEXT`,
  `ALTER TABLE respostas ADD COLUMN IF NOT EXISTS consentimento_ip TEXT`,
  `ALTER TABLE respostas ADD COLUMN IF NOT EXISTS consentimento_em TIMESTAMPTZ`,
  `DROP INDEX IF EXISTS respostas_email_unico`,
  `DROP INDEX IF EXISTS respostas_whatsapp_unico`,
  `CREATE UNIQUE INDEX IF NOT EXISTS respostas_whatsapp_unico_ativo
     ON respostas (whatsapp_norm) WHERE whatsapp_norm <> '' AND ativo`,
];

function erroDuplicado() {
  const erro = new Error('Contato já cadastrado');
  erro.duplicado = true;
  return erro;
}

function criarRepositorioPostgres(databaseUrl) {
  const { Pool } = require('pg');
  const host = (() => {
    try {
      return new URL(databaseUrl).hostname;
    } catch {
      return '';
    }
  })();
  const semSsl = host.endsWith('.railway.internal') || host === 'localhost' || host === '127.0.0.1';
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: semSsl ? false : { rejectUnauthorized: false },
  });

  return {
    tipo: 'postgres',
    async iniciar() {
      await pool.query(SCHEMA);
      for (const migracao of MIGRACOES) await pool.query(migracao);
    },
    async existeContato(whatsappNorm) {
      const { rows } = await pool.query(
        `SELECT 1 FROM respostas WHERE whatsapp_norm = $1 AND ativo LIMIT 1`,
        [whatsappNorm]
      );
      return rows.length > 0;
    },
    async definirAtivo(id, ativo) {
      try {
        const { rowCount } = await pool.query('UPDATE respostas SET ativo = $2 WHERE id = $1', [
          id,
          ativo,
        ]);
        return rowCount > 0;
      } catch (err) {
        // Reativar quando o mesmo WhatsApp já tem outra resposta ativa viola o índice.
        if (err.code === '23505') throw erroDuplicado();
        throw err;
      }
    },
    async inserir(r) {
      try {
        return await inserirPostgres(r);
      } catch (err) {
        if (err.code === '23505') throw erroDuplicado();
        throw err;
      }
    },
    async listar() {
      const { rows } = await pool.query('SELECT * FROM respostas ORDER BY criado_em ASC');
      return rows.map((row) => ({
        id: row.id,
        nome: row.nome,
        curso: row.curso,
        cursoOutro: row.curso_outro,
        periodo: row.periodo,
        whatsapp: row.whatsapp,
        respostas: row.respostas,
        scores: row.scores,
        perfil: row.perfil,
        indiceIA: row.indice_ia,
        acertouLimitacoesIA: row.acertou_limitacoes_ia,
        ativo: row.ativo,
        consentimentoAceito: row.consentimento_aceito,
        consentimentoVersao: row.consentimento_versao,
        consentimentoIp: row.consentimento_ip,
        consentimentoEm: row.consentimento_em,
        criadoEm: row.criado_em,
      }));
    },
  };

  async function inserirPostgres(r) {
      const { rows } = await pool.query(
        `INSERT INTO respostas
           (nome, curso, curso_outro, periodo, whatsapp, whatsapp_norm,
            respostas, scores, perfil, indice_ia, acertou_limitacoes_ia,
            consentimento_aceito, consentimento_versao, consentimento_ip, consentimento_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())
         RETURNING id, criado_em`,
        [
          r.nome,
          r.curso,
          r.cursoOutro,
          r.periodo,
          r.whatsapp,
          r.whatsappNorm,
          JSON.stringify(r.respostas),
          JSON.stringify(r.scores),
          r.perfil,
          r.indiceIA,
          r.acertouLimitacoesIA,
          r.consentimentoAceito,
          r.consentimentoVersao,
          r.consentimentoIp,
        ]
      );
      return { id: rows[0].id, criadoEm: rows[0].criado_em };
  }
}

function criarRepositorioMemoria() {
  const registros = [];
  let proximoId = 1;
  const contatoJaExiste = (whatsappNorm) =>
    registros.some((r) => r.ativo && r.whatsappNorm === whatsappNorm);
  return {
    tipo: 'memoria',
    async iniciar() {},
    async existeContato(whatsappNorm) {
      return contatoJaExiste(whatsappNorm);
    },
    async definirAtivo(id, ativo) {
      const registro = registros.find((r) => r.id === id);
      if (!registro) return false;
      if (
        ativo &&
        registros.some((r) => r.id !== id && r.ativo && r.whatsappNorm === registro.whatsappNorm)
      ) {
        throw erroDuplicado();
      }
      registro.ativo = ativo;
      return true;
    },
    async inserir(r) {
      // Recheca no momento da gravação, espelhando o índice UNIQUE do Postgres.
      if (contatoJaExiste(r.whatsappNorm)) throw erroDuplicado();
      const agora = new Date();
      const registro = { ...r, ativo: true, id: proximoId++, consentimentoEm: agora, criadoEm: agora };
      registros.push(registro);
      return { id: registro.id, criadoEm: registro.criadoEm };
    },
    async listar() {
      return registros.map((r) => ({ ...r, cursoOutro: r.cursoOutro ?? null }));
    },
  };
}

function criarRepositorio() {
  if (process.env.DATABASE_URL) {
    return criarRepositorioPostgres(process.env.DATABASE_URL);
  }
  console.warn(
    '[aviso] DATABASE_URL não definida — usando banco em MEMÓRIA (dados são perdidos ao reiniciar). ' +
      'No Railway, adicione um serviço PostgreSQL para persistência.'
  );
  return criarRepositorioMemoria();
}

module.exports = { criarRepositorio };
