const { test } = require('node:test');
const assert = require('node:assert');
const { calcularResultado, MAX_COMPORTAMENTAL } = require('../scoring');

// Helper: monta um envio completo a partir de overrides.
// Base "neutra": nenhuma alternativa comportamental pontua, todas as técnicas erradas,
// familiaridade com IA mínima.
function envio({ comportamental = {}, tecnica = {}, ia = {} } = {}) {
  return {
    comportamental: { c1: 'a', c2: 'a', c3: 'a', c4: 'c', c5: 'b', c6: 'b', ...comportamental },
    tecnica: {
      t1: 'a', t2: 'a', t3: 'b', t4: 'a', t5: 'a',
      t6: 'b', t7: 'a', t8: 'a', t9: 'a', t10: 'a',
      ...tecnica,
    },
    ia: { i1: 'a', i2: 'a', i3: 'a', ...ia },
  };
}

test('máximos comportamentais por área batem com o mapeamento da documentação', () => {
  assert.deepStrictEqual(MAX_COMPORTAMENTAL, { dev: 4, qa: 1, negocio: 2, dados: 1, ia: 3 });
});

test('vencedor claro: Dev com técnico e comportamental altos', () => {
  const r = calcularResultado(
    envio({
      comportamental: { c1: 'b', c3: 'c', c4: 'a', c6: 'a' }, // dev bruto 4, ia bruto 3
      tecnica: { t1: 'b', t2: 'b' }, // dev 2 acertos
    })
  );
  assert.strictEqual(r.scores.dev.total, 8);
  assert.strictEqual(r.scores.ia.comportamental, 4); // 3/3 × 4
  assert.strictEqual(r.scores.ia.total, 4); // técnico de IA zerado
  assert.strictEqual(r.perfil, 'dev'); // 8 − 4 > 1 → sem empate, mesmo com IA normalizada no teto
});

test('normalização: uma única escolha de QA vale 4 pontos comportamentais', () => {
  const r = calcularResultado(
    envio({
      comportamental: { c2: 'b' }, // única questão que pontua QA
      tecnica: { t3: 'a', t4: 'b' }, // qa 2 acertos
    })
  );
  assert.strictEqual(r.scores.qa.comportamental, 4);
  assert.strictEqual(r.scores.qa.total, 8);
  assert.strictEqual(r.perfil, 'qa');
});

test('normalização: uma escolha de IA vale 4/3 de ponto', () => {
  const r = calcularResultado(envio({ comportamental: { c1: 'b' } })); // ia bruto 1
  assert.ok(Math.abs(r.scores.ia.comportamental - 4 / 3) < 1e-9);
});

test('duelo Dev × IA com índice de IA alto → Explorador de IA, mesmo com Dev na frente', () => {
  const r = calcularResultado(
    envio({
      comportamental: { c1: 'b', c4: 'a', c3: 'c' }, // dev 3 → 3,0 · ia 2 → 2,667
      tecnica: { t1: 'b', t2: 'b', t9: 'b', t10: 'b' }, // dev 4 · ia 4
      ia: { i1: 'c', i2: 'c' }, // ambos ≥ "c" → índice alto
    })
  );
  assert.strictEqual(r.scores.dev.total, 7);
  assert.ok(Math.abs(r.scores.ia.total - (4 + 8 / 3)) < 1e-9); // 6,667 → diferença 0,333
  assert.strictEqual(r.iaAlto, true);
  assert.strictEqual(r.perfil, 'ia');
});

test('duelo Dev × IA com índice de IA baixo → Perfil Híbrido', () => {
  const r = calcularResultado(
    envio({
      comportamental: { c1: 'b', c4: 'a', c3: 'c' },
      tecnica: { t1: 'b', t2: 'b', t9: 'b', t10: 'b' },
      ia: { i1: 'b', i2: 'd' }, // i1 < "c" → índice não é alto
    })
  );
  assert.strictEqual(r.iaAlto, false);
  assert.strictEqual(r.perfil, 'hibrido');
});

test('empate entre três áreas → Híbrido mesmo com índice de IA alto', () => {
  const r = calcularResultado(
    envio({
      tecnica: { t1: 'b', t2: 'b', t3: 'a', t4: 'b', t9: 'b', t10: 'b' }, // dev, qa e ia com 4
      ia: { i1: 'd', i2: 'd' },
    })
  );
  assert.strictEqual(r.perfil, 'hibrido');
});

test('duelo sem IA (Dev × Negócio) → Híbrido', () => {
  const r = calcularResultado(
    envio({
      comportamental: { c1: 'b' }, // dev 1 → 1,0 (ia 1 → 1,333)
      tecnica: { t1: 'b', t2: 'b', t5: 'b', t6: 'a' }, // dev 4 · negócio 4
    })
  );
  assert.strictEqual(r.scores.dev.total, 5);
  assert.strictEqual(r.scores.negocio.total, 4); // diferença exata de 1 → conta como empate
  assert.strictEqual(r.perfil, 'hibrido');
});

test('diferença maior que 1 → vence a primeira área, sem consultar índice de IA', () => {
  const r = calcularResultado(
    envio({
      comportamental: { c1: 'b', c3: 'c', c4: 'a', c6: 'a' }, // dev 4 · ia 3 → norm 4
      tecnica: { t1: 'b', t2: 'b' }, // dev 8 · ia 4 → diferença 4
      ia: { i1: 'd', i2: 'd' },
    })
  );
  assert.strictEqual(r.perfil, 'dev');
});

test('Modelagem de Dados vence pelo técnico + escolha única do cenário 5', () => {
  const r = calcularResultado(
    envio({
      comportamental: { c5: 'a' }, // dados 1 → 4,0
      tecnica: { t7: 'b', t8: 'c' }, // dados 2 acertos
    })
  );
  assert.strictEqual(r.scores.dados.total, 8);
  assert.strictEqual(r.perfil, 'dados');
});

test('índice de IA e item i3 são registrados sem afetar o escore técnico', () => {
  const r = calcularResultado(envio({ ia: { i1: 'b', i2: 'd', i3: 'b' } }));
  assert.strictEqual(r.indiceIA, 4); // b=1 + d=3
  assert.strictEqual(r.iaAlto, false); // exige ambos ≥ "c"
  assert.strictEqual(r.acertouLimitacoesIA, true);
  assert.strictEqual(r.scores.ia.tecnico, 0); // i3 não soma no técnico de IA
});

test('alternativas com dois perfis somam 1 ponto para cada perfil', () => {
  const r = calcularResultado(envio({ comportamental: { c1: 'b' } }));
  assert.strictEqual(r.scores.dev.comportamentalBruto, 1);
  assert.strictEqual(r.scores.ia.comportamentalBruto, 1);
});
