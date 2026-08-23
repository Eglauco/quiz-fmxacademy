/* Fluxo do questionário: capa → identificação → 19 perguntas (uma por tela) → resultado.
   A navegação é integrada ao histórico do navegador: o gesto/botão "voltar" do celular
   volta uma tela dentro do quiz em vez de descartar as respostas. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const telas = {
    inicio: $('tela-inicio'),
    dados: $('tela-dados'),
    pergunta: $('tela-pergunta'),
    resultado: $('tela-resultado'),
    carregando: $('tela-carregando'),
  };

  const estado = {
    questionario: null,
    perguntas: [], // lista achatada: { etapaId, etapaTitulo, numeroNaEtapa, totalNaEtapa, id, texto, opcoes }
    indice: 0,
    respostas: {}, // id da pergunta → letra
    identificacao: null,
    enviando: false,
    finalizado: false,
    falhaDeRede: false, // um envio pode ter chegado ao servidor sem resposta
  };

  const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Pré-loader: a saída é feita em CSS (robusta mesmo sem JS); aqui só removemos
  // o nó do DOM depois da animação, e o dispensamos na hora sob movimento reduzido.
  const preloader = $('preloader');
  if (preloader) {
    if (movimentoReduzido) preloader.remove();
    else setTimeout(() => preloader.remove(), 3300);
  }

  function mostrarTela(nome) {
    for (const tela of Object.values(telas)) tela.classList.remove('ativa');
    telas[nome].classList.add('ativa');
    window.scrollTo(0, 0);
  }

  function focar(id) {
    const alvo = $(id);
    if (alvo) setTimeout(() => alvo.focus(), 0);
  }

  function mostrarErro(elemento, mensagem) {
    elemento.textContent = mensagem;
    elemento.classList.add('visivel');
    elemento.scrollIntoView({ block: 'center', behavior: movimentoReduzido ? 'auto' : 'smooth' });
  }

  function limparErro(elemento) {
    elemento.textContent = '';
    elemento.classList.remove('visivel');
  }

  // ---------- navegação com histórico ----------
  // destino: { tela: 'inicio' | 'dados' | 'pergunta', indice? }
  function navegar(destino, empilhar = true) {
    if (destino.tela === 'pergunta') {
      estado.indice = destino.indice;
      renderizarPergunta();
      mostrarTela('pergunta');
      focar('pergunta-texto');
    } else {
      mostrarTela(destino.tela);
    }
    if (empilhar) history.pushState(destino, '');
  }

  window.addEventListener('popstate', (evento) => {
    if (estado.finalizado) {
      // Resposta enviada: voltar não deve reabrir o quiz.
      history.pushState({ tela: 'resultado' }, '');
      return;
    }
    if (estado.enviando) {
      history.pushState({ tela: 'pergunta', indice: estado.indice }, '');
      return;
    }
    const destino = evento.state || { tela: 'inicio' };
    if (destino.tela === 'pergunta' && !estado.identificacao) {
      navegar({ tela: 'inicio' }, false);
      return;
    }
    navegar(destino, false);
  });

  window.addEventListener('beforeunload', (evento) => {
    if (estado.identificacao && !estado.finalizado) {
      evento.preventDefault();
      evento.returnValue = '';
    }
  });

  // ---------- carga inicial ----------

  async function carregarQuestionario() {
    const resposta = await fetch('/api/questionario');
    if (!resposta.ok) throw new Error('Falha ao carregar o questionário.');
    estado.questionario = await resposta.json();

    estado.perguntas = estado.questionario.etapas.flatMap((etapa) =>
      etapa.perguntas.map((pergunta, i) => ({
        etapaId: etapa.id,
        etapaTitulo: etapa.titulo,
        numeroNaEtapa: i + 1,
        totalNaEtapa: etapa.perguntas.length,
        ...pergunta,
      }))
    );

    const selectCurso = $('campo-curso');
    for (const curso of estado.questionario.cursos) {
      selectCurso.add(new Option(curso, curso));
    }
    const selectPeriodo = $('campo-periodo');
    for (const periodo of estado.questionario.periodos) {
      selectPeriodo.add(new Option(periodo, periodo));
    }
  }

  // ---------- identificação ----------

  // Espelha a canonização do servidor: remove o DDI 55 quando presente (12+ dígitos).
  function normalizarWhatsapp(texto) {
    let digitos = texto.replace(/\D/g, '');
    if (digitos.length >= 12 && digitos.startsWith('55')) digitos = digitos.slice(2);
    return digitos;
  }

  // Máscara (11) 91234-5678 aplicada enquanto digita; aceita colar com +55.
  function mascararWhatsapp(valor) {
    const digitos = normalizarWhatsapp(valor).slice(0, 11);
    if (!digitos) return '';
    if (digitos.length <= 2) return `(${digitos}`;
    const ddd = digitos.slice(0, 2);
    const numero = digitos.slice(2);
    const corte = numero.length > 8 ? 5 : 4; // 9 dígitos → 91234-5678; 8 → 1234-5678
    if (numero.length <= corte) return `(${ddd}) ${numero}`;
    return `(${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`;
  }

  function validarIdentificacao() {
    const nome = $('campo-nome').value.trim();
    const curso = $('campo-curso').value;
    const cursoOutro = $('campo-curso-outro').value.trim();
    const periodo = $('campo-periodo').value;
    const whatsapp = $('campo-whatsapp').value.trim();
    const whatsappDigitos = normalizarWhatsapp(whatsapp);

    if (nome.length < 2) return { erro: 'Informe seu nome completo.' };
    if (!curso) return { erro: 'Selecione o seu curso.' };
    if (curso === 'Outro' && !cursoOutro) return { erro: 'Especifique qual é o seu curso.' };
    if (!periodo) return { erro: 'Selecione o seu período/semestre.' };
    if (whatsappDigitos.length < 10 || whatsappDigitos.length > 11) {
      return { erro: 'Informe seu WhatsApp com DDD + número (ex.: 11 91234-5678) — é por ele que daremos o retorno.' };
    }

    return {
      dados: { nome, curso, cursoOutro: curso === 'Outro' ? cursoOutro : null, periodo, whatsapp },
    };
  }

  // ---------- perguntas ----------

  function renderizarPergunta() {
    const pergunta = estado.perguntas[estado.indice];
    const total = estado.perguntas.length;

    $('progresso-etapa').textContent =
      `${pergunta.etapaTitulo} · ${pergunta.numeroNaEtapa} de ${pergunta.totalNaEtapa}`;
    $('progresso-contagem').textContent = `${estado.indice + 1} de ${total}`;
    $('progresso-barra').style.width = `${((estado.indice + 1) / total) * 100}%`;

    $('pergunta-texto').textContent = pergunta.texto;
    limparErro($('erro-envio'));
    $('botao-corrigir-dados').hidden = true;

    const lista = $('pergunta-opcoes');
    lista.innerHTML = '';
    for (const opcao of pergunta.opcoes) {
      const item = document.createElement('li');
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'opcao';
      botao.setAttribute('aria-pressed', String(estado.respostas[pergunta.id] === opcao.letra));
      botao.innerHTML = `<span class="letra">${opcao.letra}</span><span></span>`;
      botao.lastElementChild.textContent = opcao.texto;
      botao.addEventListener('click', () => {
        estado.respostas[pergunta.id] = opcao.letra;
        for (const outro of lista.querySelectorAll('.opcao')) {
          outro.setAttribute('aria-pressed', 'false');
        }
        botao.setAttribute('aria-pressed', 'true');
        $('botao-avancar').disabled = false;
      });
      item.appendChild(botao);
      lista.appendChild(item);
    }

    $('botao-avancar').disabled = !estado.respostas[pergunta.id];
    $('botao-avancar').textContent = estado.indice === total - 1 ? 'Enviar respostas' : 'Continuar';
    $('botao-voltar').textContent = estado.indice === 0 ? 'Dados' : 'Voltar';
  }

  // ---------- envio ----------

  function montarEnvio() {
    const blocos = { comportamental: {}, tecnica: {}, ia: {} };
    for (const pergunta of estado.perguntas) {
      blocos[pergunta.etapaId][pergunta.id] = estado.respostas[pergunta.id];
    }
    return { identificacao: estado.identificacao, ...blocos };
  }

  function reabilitarEnvio() {
    const botao = $('botao-avancar');
    botao.disabled = false;
    botao.textContent = 'Enviar respostas';
    estado.enviando = false;
  }

  async function enviar() {
    if (estado.enviando) return;
    estado.enviando = true;
    const botao = $('botao-avancar');
    botao.disabled = true;
    botao.textContent = 'Enviando…';

    try {
      const resposta = await fetch('/api/respostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(montarEnvio()),
      });
      const corpo = await resposta.json().catch(() => ({}));

      if (!resposta.ok) {
        if (resposta.status === 409) {
          const mensagem = estado.falhaDeRede
            ? 'Este contato já tem uma resposta registrada — pode ter sido a sua tentativa anterior, que chegou ao servidor mesmo com a falha de conexão. Procure a equipe da FMX Academy para confirmar.'
            : corpo.erro || 'Já recebemos uma resposta com este WhatsApp.';
          mostrarErro($('erro-envio'), mensagem);
          $('botao-corrigir-dados').hidden = false;
        } else {
          mostrarErro(
            $('erro-envio'),
            corpo.erro || 'Não foi possível enviar suas respostas. Tente novamente.'
          );
        }
        reabilitarEnvio();
        return;
      }

      mostrarResultado(corpo);
    } catch {
      estado.falhaDeRede = true;
      mostrarErro($('erro-envio'), 'Sem conexão no momento. Verifique a internet e tente novamente.');
      reabilitarEnvio();
    }
  }

  function mostrarResultado({ card, perfil }) {
    estado.finalizado = true;
    document.body.classList.add(`resultado-${perfil}`);
    $('resultado-emoji').textContent = card.emoji;
    $('resultado-titulo').textContent = card.titulo;
    $('resultado-area').textContent = card.area;
    $('resultado-descricao').textContent = card.descricao;
    $('resultado-porque').textContent = card.porque;
    mostrarTela('resultado');
    history.pushState({ tela: 'resultado' }, '');
    focar('resultado-titulo');
  }

  // ---------- eventos ----------

  $('botao-comecar').addEventListener('click', () => navegar({ tela: 'dados' }));
  $('botao-voltar-inicio').addEventListener('click', () => history.back());

  $('campo-curso').addEventListener('change', () => {
    $('campo-curso-outro-wrap').hidden = $('campo-curso').value !== 'Outro';
  });

  $('campo-whatsapp').addEventListener('input', (evento) => {
    evento.target.value = mascararWhatsapp(evento.target.value);
  });

  $('form-dados').addEventListener('submit', (evento) => {
    evento.preventDefault();
    const { erro, dados } = validarIdentificacao();
    if (erro) {
      mostrarErro($('erro-dados'), erro);
      return;
    }
    limparErro($('erro-dados'));
    estado.identificacao = dados;
    navegar({ tela: 'pergunta', indice: estado.indice });
  });

  $('botao-voltar').addEventListener('click', () => {
    if (estado.enviando) return;
    history.back();
  });

  $('botao-corrigir-dados').addEventListener('click', () => {
    limparErro($('erro-envio'));
    $('botao-corrigir-dados').hidden = true;
    navegar({ tela: 'dados' });
  });

  $('botao-avancar').addEventListener('click', () => {
    const pergunta = estado.perguntas[estado.indice];
    if (!estado.respostas[pergunta.id]) return;
    if (estado.indice === estado.perguntas.length - 1) {
      enviar();
    } else {
      navegar({ tela: 'pergunta', indice: estado.indice + 1 });
    }
  });

  // ---------- início ----------

  mostrarTela('carregando');
  carregarQuestionario()
    .then(() => {
      history.replaceState({ tela: 'inicio' }, '');
      mostrarTela('inicio');
    })
    .catch(() => {
      $('texto-carregando').textContent =
        'Não foi possível carregar o questionário. Atualize a página para tentar de novo.';
    });
})();
