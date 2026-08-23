# Quiz FMX Academy — Qual é o seu caminho tech?

Formulário de pré-cadastro e triagem do Programa de Formação (Estágio). O aluno escaneia um
QR Code, responde 19 perguntas no celular e recebe na hora o perfil de carreira com maior
afinidade (Dev, QA, Negócio/Requisitos, Modelagem de Dados, Eng. de IA ou Híbrido). As
respostas ficam no banco para relatórios e estatísticas.

A especificação das perguntas e da regra de pontuação está em
`documentacao/Formulario_Pre_Cadastro_Formacao.docx`.

## Stack

| Camada | Tecnologia |
|---|---|
| Servidor/API | Node.js + Express |
| Banco | PostgreSQL (Railway) — em memória quando `DATABASE_URL` não existe |
| Frontend | HTML/CSS/JS puro, mobile-first |
| QR Code | biblioteca `qrcode` |

## Páginas e endpoints

| Rota | O que é |
|---|---|
| `/` | Questionário (o link do QR Code) |
| `/admin` | Relatórios, estatísticas e QR Code para impressão |
| `/api/relatorio.csv` | Exportação da tabulação completa (abre no Excel) |

## Rodando localmente

```bash
npm install
npm start
```

Abre em `http://localhost:3000`. Sem `DATABASE_URL`, os dados ficam **em memória** (somem ao
reiniciar) — suficiente para testar. Para usar um Postgres local/remoto, defina a variável
`DATABASE_URL` antes de iniciar.

Testes da regra de pontuação:

```bash
npm test
```

## Deploy no Railway

1. **Suba o código para o GitHub** (o Railway faz deploy a partir do repositório):
   ```bash
   git init
   git add .
   git commit -m "Quiz de triagem FMX Academy"
   ```
   Crie um repositório no GitHub e faça o push.

2. **Crie o projeto no Railway**: [railway.app](https://railway.app) → *New Project* →
   *Deploy from GitHub repo* → selecione o repositório. O Railway detecta o Node
   automaticamente e usa o `npm start`.

3. **Adicione o banco**: no projeto, *Create* → *Database* → *PostgreSQL*.
   Depois, no serviço da aplicação, aba *Variables*, adicione a referência:
   `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`.
   A tabela é criada automaticamente na primeira inicialização.

4. **Gere o domínio público**: no serviço da aplicação, *Settings* → *Networking* →
   *Generate Domain*. Essa URL é a que o QR Code (na página `/admin`) vai apontar.

5. Pronto — abra `https://SEU-DOMINIO.up.railway.app/admin`, baixe/imprima o QR Code e
   distribua para os alunos.

### Variáveis de ambiente opcionais

| Variável | Efeito |
|---|---|
| `ADMIN_PASSWORD` | Se definida, `/admin`, `/api/relatorio*` e `/api/qrcode` passam a exigir essa senha (usuário em branco). Sem ela, a área de relatórios fica aberta. |
| `PUBLIC_URL` | Força a URL usada no QR Code (por padrão usa o domínio público do Railway). |

## Regra de afinidade (resumo)

Para cada área: `total = (acertos técnicos da Seção 3 × 2) + comportamental normalizado`,
onde o comportamental é `(pontos indicados ÷ máximo da área) × 4` — tetos iguais (0 a 8)
para todas as áreas. Diferença > 1 ponto para a 2ª colocada → vence a 1ª. Caso contrário:
duelo de exatamente 2 áreas incluindo Eng. de IA com índice de familiaridade alto (itens 1
e 2 da Seção 4 ambos ≥ “c”) → Explorador de IA; qualquer outro empate → Perfil Híbrido.
A implementação está em `scoring.js`, com os casos de borda cobertos em
`test/scoring.test.js`.
