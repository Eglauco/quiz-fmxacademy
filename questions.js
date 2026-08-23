// Fonte única das perguntas do formulário, transcritas da documentação da analista
// (documentacao/Formulario_Pre_Cadastro_Formacao.docx).
//
// ATENÇÃO: os campos `areas` (Seção 2), `correta` (Seção 3 e i3) e `valor` (Seção 4)
// são de USO INTERNO e nunca devem ser enviados ao candidato. Use `questionarioPublico()`
// para obter a versão sem gabarito.

const AREA_LABELS = {
  dev: 'Desenvolvimento',
  qa: 'Qualidade / QA',
  negocio: 'Negócio / Requisitos',
  dados: 'Modelagem de Dados',
  ia: 'Engenharia de IA',
};

const CURSOS = [
  'Ciência da Computação',
  'Sistemas de Informação',
  'Engenharia de Software',
  'Engenharia da Computação',
  'Análise e Desenvolvimento de Sistemas',
  'Ciência de Dados',
  'Outro',
];

const PERIODOS = ['1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º ou mais', 'Recém-formado(a)'];

// Seção 2 — Perfil Comportamental. Cada alternativa soma 1 ponto para CADA área listada.
const COMPORTAMENTAL = [
  {
    id: 'c1',
    texto:
      'Você recebe uma tarefa com prazo apertado e percebe, no meio da execução, que uma das instruções recebidas parece incoerente. O que você faz?',
    opcoes: {
      a: { texto: 'Sigo exatamente o que foi passado, para não atrasar o prazo.', areas: [] },
      b: {
        texto: 'Paro, registro a inconsistência, sigo com a interpretação mais lógica e aviso depois.',
        areas: ['dev', 'ia'],
      },
      c: {
        texto:
          'Envio uma mensagem imediatamente para quem passou a tarefa, explico a inconsistência e aguardo resposta.',
        areas: ['negocio'],
      },
      d: { texto: 'Peço para um colega decidir, já que não tenho certeza.', areas: [] },
    },
  },
  {
    id: 'c2',
    texto:
      'Ao revisar um relatório antes de enviar, você percebe pequenas inconsistências de formatação que não afetam o conteúdo. Você:',
    opcoes: {
      a: { texto: 'Ignora, pois o conteúdo está correto e o prazo é curto.', areas: [] },
      b: { texto: 'Corrige tudo antes de enviar, mesmo levando mais tempo.', areas: ['qa'] },
      c: { texto: 'Envia e avisa que fará ajustes depois.', areas: [] },
      d: { texto: 'Pede para outra pessoa revisar, já que percebeu algo estranho.', areas: [] },
    },
  },
  {
    id: 'c3',
    texto:
      'Durante um trabalho em grupo, dois colegas divergem sobre a melhor solução para um problema. Você:',
    opcoes: {
      a: { texto: 'Fico neutro e sigo o que a maioria decidir.', areas: [] },
      b: {
        texto:
          'Escuto os dois pontos de vista, resumo os argumentos e proponho um caminho que integre ambos.',
        areas: ['negocio'],
      },
      c: {
        texto: 'Defendo a solução que considero tecnicamente mais correta, mesmo gerando atrito.',
        areas: ['dev'],
      },
      d: { texto: 'Prefiro não me envolver e continuar minha parte da tarefa.', areas: [] },
    },
  },
  {
    id: 'c4',
    texto:
      'Você está diante de um problema totalmente novo, sem exemplos parecidos para se basear. Sua primeira reação é:',
    opcoes: {
      a: {
        texto: 'Buscar informações e entender a lógica por trás do problema antes de agir.',
        areas: ['dev', 'ia'],
      },
      b: { texto: 'Tentar resolver por tentativa e erro até funcionar.', areas: ['dev'] },
      c: { texto: 'Pedir ajuda de alguém mais experiente antes de tentar sozinho.', areas: [] },
      d: { texto: 'Deixar para depois, esperando surgir mais contexto.', areas: [] },
    },
  },
  {
    id: 'c5',
    texto:
      'Você recebe uma grande quantidade de informações desorganizadas e precisa entender como elas se relacionam. Você prefere:',
    opcoes: {
      a: {
        texto: 'Criar esquemas, tabelas ou diagramas para organizar visualmente as relações.',
        areas: ['dados'],
      },
      b: { texto: 'Ler tudo com atenção e ir memorizando as conexões.', areas: [] },
      c: { texto: 'Separar as informações em grupos por ordem de chegada.', areas: [] },
      d: { texto: 'Pedir para alguém organizar por você.', areas: [] },
    },
  },
  {
    id: 'c6',
    texto: 'Uma nova ferramenta ou tecnologia é lançada na sua área. Sua reação mais comum é:',
    opcoes: {
      a: { texto: 'Pesquisar e testar por conta própria para entender como funciona.', areas: ['ia', 'dev'] },
      b: { texto: 'Esperar até que seja obrigatório usar.', areas: [] },
      c: { texto: 'Perguntar a colegas se vale a pena antes de testar.', areas: [] },
      d: { texto: 'Ler sobre ela, mas raramente chega a testar.', areas: [] },
    },
  },
];

// Seção 3 — Conhecimento Técnico (2 questões por área, com gabarito).
const TECNICA = [
  {
    id: 't1',
    area: 'dev',
    texto:
      'Qual estrutura de repetição é mais indicada quando não se sabe previamente quantas vezes o código precisa repetir, mas sim até que uma condição deixe de ser verdadeira?',
    opcoes: { a: 'for', b: 'while', c: 'switch', d: 'if-else' },
    correta: 'b',
  },
  {
    id: 't2',
    area: 'dev',
    texto:
      'Em programação orientada a objetos, o conceito que permite que uma classe filha reutilize e estenda o comportamento de uma classe pai é chamado de:',
    opcoes: { a: 'Encapsulamento', b: 'Herança', c: 'Polimorfismo', d: 'Abstração' },
    correta: 'b',
  },
  {
    id: 't3',
    area: 'qa',
    texto:
      'Qual tipo de teste tem como objetivo verificar se, após uma alteração no sistema, funcionalidades que já existiam continuam funcionando corretamente?',
    opcoes: {
      a: 'Teste de regressão',
      b: 'Teste de carga',
      c: 'Teste unitário',
      d: 'Teste exploratório',
    },
    correta: 'a',
  },
  {
    id: 't4',
    area: 'qa',
    texto:
      'Ao encontrar um comportamento inesperado em um sistema, qual é a prática mais adequada antes de reportar o problema?',
    opcoes: {
      a: 'Reportar imediatamente com uma descrição genérica',
      b: 'Reproduzir o erro e documentar passos e resultado esperado x obtido',
      c: 'Corrigir o problema diretamente no sistema',
      d: 'Ignorar caso pareça um erro pequeno',
    },
    correta: 'b',
  },
  {
    id: 't5',
    area: 'negocio',
    texto:
      'Um documento que descreve, de forma clara e sem ambiguidade, o que um sistema deve fazer sob a ótica do usuário/negócio é chamado de:',
    opcoes: {
      a: 'Manual técnico',
      b: 'Requisito funcional',
      c: 'Log de sistema',
      d: 'Backlog de bugs',
    },
    correta: 'b',
  },
  {
    id: 't6',
    area: 'negocio',
    texto:
      'Durante o levantamento de requisitos, a técnica que consiste em conversar diretamente com usuários/stakeholders para entender suas necessidades é chamada de:',
    opcoes: { a: 'Entrevista', b: 'Teste A/B', c: 'Code review', d: 'Deploy' },
    correta: 'a',
  },
  {
    id: 't7',
    area: 'dados',
    texto:
      'Em um banco de dados relacional, a chave que identifica de forma única cada registro de uma tabela é chamada de:',
    opcoes: {
      a: 'Chave estrangeira',
      b: 'Chave primária',
      c: 'Índice secundário',
      d: 'Chave composta apenas',
    },
    correta: 'b',
  },
  {
    id: 't8',
    area: 'dados',
    texto:
      'Quando um registro de uma tabela pode estar associado a vários registros de outra tabela, esse relacionamento é chamado de:',
    opcoes: {
      a: 'Um-para-um',
      b: 'Muitos-para-muitos',
      c: 'Um-para-muitos',
      d: 'Não há relação possível',
    },
    correta: 'c',
  },
  {
    id: 't9',
    area: 'ia',
    texto: 'O que é, de forma resumida, um “modelo de linguagem” (LLM)?',
    opcoes: {
      a: 'Um banco de dados de respostas prontas',
      b: 'Um sistema treinado para prever/gerar texto com base em padrões estatísticos aprendidos de grandes volumes de dados',
      c: 'Um programa que só traduz idiomas',
      d: 'Um tipo de antivírus',
    },
    correta: 'b',
  },
  {
    id: 't10',
    area: 'ia',
    texto: 'O termo “prompt engineering” se refere a:',
    opcoes: {
      a: 'Construir hardware para IA',
      b: 'Elaborar instruções/entradas de forma estratégica para obter melhores respostas de um modelo de IA',
      c: 'Uma linguagem de programação',
      d: 'Treinar uma rede neural do zero',
    },
    correta: 'b',
  },
];

// Seção 4 — Familiaridade prática com IA.
// i1 e i2 geram o índice de maturidade (a=0 … d=3); i3 é objetiva e fica só para relatório.
const IA_FAMILIARIDADE = [
  {
    id: 'i1',
    tipo: 'indice',
    texto:
      'Com que frequência você utiliza ferramentas de IA (ChatGPT, Claude, Copilot, Gemini etc.) em seus estudos ou projetos?',
    opcoes: {
      a: 'Nunca utilizei',
      b: 'Já utilizei algumas vezes, de forma exploratória',
      c: 'Utilizo regularmente para estudar ou resolver problemas',
      d: 'Utilizo integrando com ferramentas/código (ex.: APIs, automações)',
    },
  },
  {
    id: 'i2',
    tipo: 'indice',
    texto:
      'Você já testou ferramentas de IA generativa para gerar código, testes ou documentação técnica?',
    opcoes: {
      a: 'Não conheço esse tipo de uso',
      b: 'Já ouvi falar mas nunca testei',
      c: 'Já testei algumas vezes',
      d: 'Uso com frequência no dia a dia de estudos/projetos',
    },
  },
  {
    id: 'i3',
    tipo: 'objetiva',
    texto:
      'Qual das opções abaixo melhor descreve uma limitação real das ferramentas de IA generativa atuais?',
    opcoes: {
      a: 'Elas nunca cometem erros ou “alucinações”',
      b: 'Podem gerar respostas incorretas com aparência de certeza, exigindo validação humana',
      c: 'Substituem completamente a revisão técnica',
      d: 'Não conseguem gerar nenhum tipo de texto técnico',
    },
    correta: 'b',
  },
];

// Seção 6 — cards de resultado devolvidos ao candidato.
const CARDS = {
  dev: {
    emoji: '💻',
    titulo: 'O Construtor de Soluções',
    area: 'Desenvolvimento',
    descricao:
      'Enquanto todo mundo vê um problema, você já está pensando em como quebrá-lo em pedaços menores e montar a solução peça por peça. Curte lógica, gosta de testar até funcionar e não se incomoda de errar várias vezes até acertar — pra você, isso é só parte do processo.',
    porque:
      'Você acertou as questões de lógica/POO e, nos cenários, preferiu investigar e resolver por conta própria em vez de esperar instruções prontas — a marca registrada de quem programa.',
  },
  qa: {
    emoji: '🔍',
    titulo: 'O Caçador de Bugs',
    area: 'Qualidade / QA',
    descricao:
      'Você é do tipo que nota quando algo está “quase certo” — e isso, pra você, não é suficiente. Tem paciência para testar tudo de novo, gosta de processo bem-feito e adora encontrar o detalhe que ninguém mais viu.',
    porque:
      'Você foi bem nas questões sobre teste e regressão e, nos cenários, escolheu corrigir e revisar com calma em vez de deixar passar — perfil clássico de quem garante qualidade.',
  },
  negocio: {
    emoji: '🤝',
    titulo: 'O Tradutor',
    area: 'Negócio / Requisitos',
    descricao:
      'Você entende gente tão bem quanto entende sistema. Consegue pegar uma ideia bagunçada de um cliente ou stakeholder e transformar em algo claro que o time técnico consegue executar. Ouve mais do que fala, mas quando fala, resume o que ninguém tinha conseguido colocar em palavras.',
    porque:
      'Você mandou bem nas questões de levantamento de requisitos e, nos cenários, priorizou conversar, ouvir os dois lados e alinhar antes de agir — essência de quem conecta negócio e tecnologia.',
  },
  dados: {
    emoji: '🗂️',
    titulo: 'O Arquiteto de Dados',
    area: 'Modelagem de Dados',
    descricao:
      'Informação bagunçada é praticamente um convite para você organizar. Gosta de entender como as coisas se relacionam, de desenhar estrutura antes de sair fazendo, e tem prazer em deixar tudo no lugar certo — literalmente.',
    porque:
      'Você acertou as questões sobre chaves e relacionamentos e, nos cenários, preferiu criar esquemas e diagramas para organizar informação solta — raciocínio típico de quem modela dados.',
  },
  ia: {
    emoji: '🤖',
    titulo: 'O Explorador de IA',
    area: 'Engenharia de IA',
    descricao:
      'Ferramenta nova saiu? Você já tá testando antes de todo mundo. Curte entender “como” a IA chega numa resposta, não só usar — e não tem medo de mexer em algo que ainda está sendo inventado.',
    porque:
      'Você mostrou domínio nas questões sobre IA/LLMs, usa ferramentas de IA com frequência real (não só ouviu falar) e, nos cenários, foi o primeiro a testar novidades por conta própria.',
  },
  hibrido: {
    emoji: '🧩',
    titulo: 'O Multitarefa',
    area: 'Perfil Híbrido',
    descricao:
      'Você não se encaixou 100% em uma única caixinha — e tudo bem, isso também é um perfil. Você transita bem entre áreas diferentes, o que costuma combinar com times pequenos ou funções mais generalistas, onde é preciso vestir mais de um chapéu.',
    porque:
      'Seus escores técnico e comportamental ficaram próximos entre duas ou mais áreas, sem uma que se destacasse claramente das demais.',
  },
};

// Versão pública do questionário: sem gabarito, sem mapeamento de áreas, sem valores.
function questionarioPublico() {
  const opcoesPublicas = (opcoes) =>
    Object.entries(opcoes).map(([letra, valor]) => ({
      letra,
      texto: typeof valor === 'string' ? valor : valor.texto,
    }));

  return {
    cursos: CURSOS,
    periodos: PERIODOS,
    etapas: [
      {
        id: 'comportamental',
        titulo: 'Cenários',
        perguntas: COMPORTAMENTAL.map((q) => ({ id: q.id, texto: q.texto, opcoes: opcoesPublicas(q.opcoes) })),
      },
      {
        id: 'tecnica',
        titulo: 'Conhecimento técnico',
        perguntas: TECNICA.map((q) => ({ id: q.id, texto: q.texto, opcoes: opcoesPublicas(q.opcoes) })),
      },
      {
        id: 'ia',
        titulo: 'Você e a IA',
        perguntas: IA_FAMILIARIDADE.map((q) => ({ id: q.id, texto: q.texto, opcoes: opcoesPublicas(q.opcoes) })),
      },
    ],
  };
}

module.exports = {
  AREA_LABELS,
  CURSOS,
  PERIODOS,
  COMPORTAMENTAL,
  TECNICA,
  IA_FAMILIARIDADE,
  CARDS,
  questionarioPublico,
};
