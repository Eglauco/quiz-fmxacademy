// Regra de negócio da triagem, conforme Seções 5 e 6 da documentação e as
// definições da analista:
//
// Para cada área (dev, qa, negocio, dados, ia):
//   técnico       = acertos na Seção 3 (0 a 2) × 2                      → 0 a 4
//   comportamental = (pontos indicados ÷ máximo possível da área) × 4    → 0 a 4 (normalizado)
//   total          = técnico + comportamental                            → 0 a 8
//
// Resultado:
//   1) Se a 1ª área supera a 2ª por MAIS de 1 ponto → card da 1ª área.
//   2) Senão, entre as áreas a até 1 ponto do líder:
//      - exatamente 2 áreas, uma delas 'ia', e índice de IA alto
//        (itens i1 e i2 da Seção 4 ambos ≥ "c") → Explorador de IA;
//      - qualquer outro caso → Perfil Híbrido.
//
// O item i3 da Seção 4 não pontua em nada — fica registrado só para relatório.

const { AREA_LABELS, COMPORTAMENTAL, TECNICA, CARDS } = require('./questions');

const AREAS = Object.keys(AREA_LABELS);
const EPS = 1e-9;
const MARGEM_EMPATE = 1;

// Máximo comportamental por área: nº de questões em que a área aparece em alguma
// alternativa (o candidato só escolhe uma alternativa por questão).
const MAX_COMPORTAMENTAL = {};
for (const area of AREAS) {
  MAX_COMPORTAMENTAL[area] = COMPORTAMENTAL.filter((q) =>
    Object.values(q.opcoes).some((o) => o.areas.includes(area))
  ).length;
}

const VALOR_INDICE = { a: 0, b: 1, c: 2, d: 3 };

function calcularResultado({ comportamental, tecnica, ia }) {
  const scores = {};
  for (const area of AREAS) {
    scores[area] = { tecnicoAcertos: 0, tecnico: 0, comportamentalBruto: 0, comportamental: 0, total: 0 };
  }

  for (const questao of TECNICA) {
    if (tecnica[questao.id] === questao.correta) {
      scores[questao.area].tecnicoAcertos += 1;
    }
  }

  for (const questao of COMPORTAMENTAL) {
    const escolha = questao.opcoes[comportamental[questao.id]];
    if (!escolha) continue;
    for (const area of escolha.areas) {
      scores[area].comportamentalBruto += 1;
    }
  }

  for (const area of AREAS) {
    const s = scores[area];
    s.tecnico = s.tecnicoAcertos * 2;
    s.comportamental =
      MAX_COMPORTAMENTAL[area] > 0 ? (s.comportamentalBruto / MAX_COMPORTAMENTAL[area]) * 4 : 0;
    s.total = s.tecnico + s.comportamental;
  }

  const indiceIA = (VALOR_INDICE[ia.i1] ?? 0) + (VALOR_INDICE[ia.i2] ?? 0);
  const iaAlto = (VALOR_INDICE[ia.i1] ?? 0) >= 2 && (VALOR_INDICE[ia.i2] ?? 0) >= 2;
  const acertouLimitacoesIA = ia.i3 === 'b';

  const ordenadas = [...AREAS].sort((x, y) => scores[y].total - scores[x].total);
  const topo = scores[ordenadas[0]].total;
  const empatadas = AREAS.filter((area) => topo - scores[area].total <= MARGEM_EMPATE + EPS);

  let perfil;
  if (empatadas.length === 1) {
    perfil = ordenadas[0];
  } else if (empatadas.length === 2 && empatadas.includes('ia') && iaAlto) {
    perfil = 'ia';
  } else {
    perfil = 'hibrido';
  }

  return {
    perfil,
    card: CARDS[perfil],
    scores,
    indiceIA,
    iaAlto,
    acertouLimitacoesIA,
  };
}

module.exports = { calcularResultado, AREAS, MAX_COMPORTAMENTAL };
