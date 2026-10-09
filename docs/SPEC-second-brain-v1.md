<!-- /autoplan restore point: "/root/.gstack/projects/hub-jessica/HEAD-autoplan-restore-20260930-223540.md" -->
## Implementation plan
---
spec_version: 1
project: hub-jessica
component: second-brain
status: draft
date: 2026-09-30
author: Pandaktwok + Claude (/spec)
design_approved: variant-A "Carta Celeste" (~/.gstack/projects/hub-jessica/designs/second-brain-orbital-20260930/approved.json)
---

# ÉPICO — Second Brain v1

## Context

Jessica Zock conduz mentoria de posicionamento para profissionais liberais da saúde.
Hoje todo o conhecimento dela (TCCs de alunas, livros, anotações, conclusões de
atendimento, material dos projetos) vive espalhado entre pastas, Notion, Gmail e Drive.
Nada disso é pesquisável em conjunto, e nada alimenta o trabalho dela de volta.

O Second Brain é o primeiro dos dois programas. Ele é a base: guarda os arquivos,
indexa, roda skills e expõe uma API. O Hub de Diagnóstico (segundo programa, spec
separado) nasce em cima dele e grava o que produz numa categoria dedicada.

Decidido nesta sessão: o Second Brain vai ao ar primeiro, porque o Hub depende dele
como banco e como registro de skills.

## Current State

Projeto vazio. `C:\Users\Pandaktwok\Documents\projetos\hub-jessica` contém um arquivo:
`Hub de Diagnostico - Especificacao Funcional.pdf` (13 páginas, 231 KB). Zero linha
de código. Greenfield confirmado por varredura em 2026-09-30.

Existem dois artefatos de design aprovados nesta sessão, em
`~/.gstack/projects/hub-jessica/designs/second-brain-orbital-20260930/`:
`variant-a.html` (tela principal funcionando, 1.247 pontos, interação completa) e
`approved.json` (tokens de cor, tipografia e geometria).

### Restrição verificada (não contornar)

Skills não sincronizam entre superfícies da Claude. A documentação oficial é explícita:
*"Custom Skills do not sync across surfaces. Skills uploaded to one surface are not
automatically available on others."* O app claude.ai é individual, a API é por workspace,
o Claude Code é por sistema de arquivos. Não existe endpoint público documentado para
listar conectores de uma conta.

Consequência de desenho: o Second Brain **é dono** das próprias skills (arquivos em
disco) e das próprias conexões (configuradas pela usuária). A chave da Claude serve
só para as chamadas de LLM. Nada no produto depende de ler o estado da conta dela.

### Decisão de fundação (revisão CEO, ROW-01, decisão 7bd5b096)

O spec original mandava construir tudo: vigia de pastas, extração de texto,
embeddings, busca semântica, grafo e banco. Cerca de dois terços do esforço para
reimplementar o que já existe pronto e testado.

**Decidido:** a fundação vem de bibliotecas de terceiros. Construímos apenas a
camada que não existe em lugar nenhum: a tela orbital Carta Celeste, a camada de
Categorias como skill-ponte, a API escopada por categoria, e a integração com o Hub.

**Restrição de licença (verificada, não negociável).** Este produto é vendido e pode
rodar numa VPS acessível pela rede. Toda dependência precisa de licença permissiva
(MIT, Apache 2.0, BSD). Licença copyleft de rede fica fora: Khoj, o second brain
open source mais maduro da categoria, é AGPL-3.0, verificado no `LICENSE` do
repositório em 2026-09-30. Adotá-lo obrigaria a abrir o código deste produto para
qualquer pessoa que o usasse pela rede.

Por isso a fundação vem de **bibliotecas**, nunca de um aplicativo inteiro. Licenças
conferidas na fonte, no mesmo dia:

| Peça | Biblioteca | Licença |
|---|---|---|
| Vigia de pastas | `chokidar` | MIT |
| Busca vetorial em SQLite | `sqlite-vec` | Apache 2.0 |
| Embeddings locais | `transformers.js` | Apache 2.0 |
| Alternativa de índice vetorial | `lancedb` | Apache 2.0 |
| Extração de texto | a definir na issue #3, mesmo critério de licença |

Qualquer dependência nova passa pelo mesmo teste antes de entrar: ler o arquivo de
licença no repositório de origem, não confiar no que o README diz.

## Proposed Change

Aplicação web em Docker, um único alvo de deploy, que roda igual em `localhost` na
máquina da Jessica e atrás de domínio com HTTPS numa VPS que ela contrata.

### Princípio arquitetural central

**As pastas são a verdade. O banco é índice descartável.**

Os arquivos vivem no disco, organizados por categoria. O SQLite guarda caminho,
categoria, resumo, embedding e arestas do grafo. Apagar o banco e reindexar reconstrói
tudo. Se ela mexer num arquivo pelo Explorer, o watcher acompanha. Nada do conteúdo
dela fica preso num formato que só este programa entende.

```
~/second-brain/
  arquivos/
    business/
    content/
    personal/
    community/
    consultoria/          <- o Hub grava aqui
  skills/
    organizar/SKILL.md
    indexar/SKILL.md
    varredura/SKILL.md
    ...
  cofre/                  <- criptografado quando ativado
  config.yaml
  index.db                <- SQLite, reconstruível
```

### As cinco camadas (ARMS + o anel que faltava)

Do centro para fora, com distância igual entre camadas:

| # | Camada | O que é | Origem |
|---|--------|---------|--------|
| 0 | Claude | núcleo, chave de API da Jessica | configuração |
| 1 | Skills | pastas com SKILL.md | arquivos do programa |
| 2 | **Categorias** | uma skill-ponte por categoria | criada pela usuária |
| 3 | Memórias | um ponto por arquivo | watcher |
| 4 | Rotinas | tarefas agendadas | criadas pela usuária |
| 5 | Apps | atalhos para apps conectados | configuração |

A camada 2 é nova em relação ao design aprovado e precisa entrar no protótipo.
Cada categoria é uma skill própria, com arquivo `SKILL.md`, que define: quais skills
da camada 1 ela pode acionar, quais pastas de memória ela cobre, e as regras de
classificação dela. Todo arquivo que entra passa pela skill da sua categoria antes
de ser indexado. É a ponte entre o que o Claude sabe fazer e o que a Jessica guardou.

### Pipeline de ingestão

```
arquivo novo/alterado no disco
   -> watcher detecta
   -> fila de ingestão
   -> skill de varredura: hash, dedup, classifica categoria, detecta dado sensível
   -> [se sensível e cofre ativo] pergunta à usuária, move para o cofre
   -> extrai texto (pdf, docx, md, txt, xlsx)
   -> gera embedding local
   -> calcula arestas por similaridade
   -> grava no índice
   -> evento via WebSocket
   -> ponto nasce no anel, na cor da categoria
```

Da gravação até aparecer na tela: segundos. O Hub usa exatamente este caminho,
sem via especial: grava o arquivo na pasta `consultoria/` e o watcher faz o resto.

### Grafo de ligações

Duas origens, mesma tabela:

- **Explícitas**: quem gerou o quê. O Hub grava a aresta junto com o arquivo
  (módulo 4 nasceu do 1 e do 2). Peso 1.0, nunca recalculada.
- **Descobertas**: similaridade de embedding acima do limiar. Recalculadas na
  reindexação.

Na tela: hover num ponto desenha as linhas até os conectados e esmaece todo o resto.
Clique abre a pré-visualização com "N arquivos conectados" e uma seta que expande a
lista completa, sem limite de quantidade. Vale igual para skills conectadas entre si.

### Cofre

Totalmente opcional, decisão dela em duas etapas. Primeiro: quer cofre? Se não, os
arquivos ficam soltos e o programa nunca mais pergunta. Se sim: quer senha?

Com senha, a chave deriva dela (Argon2id), o servidor nunca guarda a chave, e ela
digita quando um dado do cofre for usado. Sem senha, a chave fica no `config.yaml`
com permissão restrita: protege contra backup roubado ou disco vazado, não contra
quem tem acesso ao servidor. **O texto da interface precisa dizer exatamente isso**,
sem prometer mais do que entrega.

### Busca semântica

Embeddings gerados localmente, sem internet, sem custo por arquivo. Nenhum texto dela
sai da máquina, o que importa porque o conteúdo inclui TCC de aluna e dado de mentorada.
Modelo multilíngue com bom desempenho em português. Exige cerca de 2 GB de RAM além do
resto. Como o índice é reconstruível, trocar de modelo depois é reindexar, não migrar.

### Schema (SQLite)

```sql
CREATE TABLE categorias (
  id          TEXT PRIMARY KEY,
  nome        TEXT NOT NULL UNIQUE,
  cor         TEXT NOT NULL,              -- hex, escolhida pela usuária
  pasta       TEXT NOT NULL UNIQUE,
  skill_path  TEXT NOT NULL,              -- SKILL.md da ponte
  criada_em   TEXT NOT NULL
);

CREATE TABLE arquivos (
  id            TEXT PRIMARY KEY,
  caminho       TEXT NOT NULL UNIQUE,
  categoria_id  TEXT NOT NULL REFERENCES categorias(id),
  nome          TEXT NOT NULL,
  hash          TEXT NOT NULL,            -- sha256, dedup
  tamanho       INTEGER NOT NULL,
  mtime         INTEGER NOT NULL,
  resumo        TEXT,
  no_cofre      INTEGER NOT NULL DEFAULT 0,
  indexado_em   TEXT
);
CREATE INDEX idx_arq_cat ON arquivos(categoria_id);
CREATE UNIQUE INDEX idx_arq_hash ON arquivos(hash);

CREATE TABLE embeddings (
  arquivo_id  TEXT PRIMARY KEY REFERENCES arquivos(id) ON DELETE CASCADE,
  vetor       BLOB NOT NULL,
  modelo      TEXT NOT NULL,
  dim         INTEGER NOT NULL
);

CREATE TABLE ligacoes (
  origem_id   TEXT NOT NULL REFERENCES arquivos(id) ON DELETE CASCADE,
  destino_id  TEXT NOT NULL REFERENCES arquivos(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK(tipo IN ('explicita','descoberta')),
  peso        REAL NOT NULL,
  PRIMARY KEY (origem_id, destino_id, tipo)
);
CREATE INDEX idx_lig_origem ON ligacoes(origem_id);

CREATE TABLE skills (
  id          TEXT PRIMARY KEY,
  nome        TEXT NOT NULL UNIQUE,
  caminho     TEXT NOT NULL,
  descricao   TEXT,
  gatilhos    TEXT,                       -- json
  ativa       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE rotinas (
  id          TEXT PRIMARY KEY,
  nome        TEXT NOT NULL,
  cron        TEXT NOT NULL,
  skill_id    TEXT REFERENCES skills(id),
  ativa       INTEGER NOT NULL DEFAULT 1,
  ultima_exec TEXT,
  ultimo_erro TEXT
);

CREATE TABLE apps (
  id          TEXT PRIMARY KEY,
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL,              -- mcp | atalho
  config      TEXT,                       -- json
  url_atalho  TEXT
);

CREATE TABLE uso_modelo (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  modelo        TEXT NOT NULL,
  tokens_in     INTEGER NOT NULL,
  tokens_out    INTEGER NOT NULL,
  origem        TEXT NOT NULL,            -- skill | rotina | hub | chat
  criado_em     TEXT NOT NULL
);
```

### API HTTP (consumida pelo Hub)

Token Bearer por cliente. Cada token é amarrado às categorias que pode ver. O token
do Hub enxerga **só** `consultoria`. Isso é o que impede que uma falha no Hub, que
fica exposto na internet, alcance as memórias pessoais dela ou o cofre.

```
POST   /api/v1/arquivos          cria arquivo numa categoria permitida
         { categoria, nome, conteudo, ligacoes_explicitas: [id] }
         -> 201 { id, caminho }

GET    /api/v1/arquivos/:id      metadados + conteúdo (se permitido)
GET    /api/v1/busca?q=&cat=     busca semântica, escopo limitado ao token
GET    /api/v1/arquivos/:id/ligacoes
POST   /api/v1/skills/:nome/run  roda skill sobre arquivos
         { arquivos: [id], params: {} }
         -> 202 { job_id }
GET    /api/v1/jobs/:id          status da execução
WS     /api/v1/eventos           arquivo.criado, arquivo.indexado, job.concluido
```

Tudo fora do escopo do token responde 403, não 404 com dados.

### Interface

A tela principal é a variante A aprovada, com três adições:

1. O anel de Categorias entre Skills e Memórias.
2. O grafo no hover e a lista expansível de conectados no clique.
3. Engrenagem ao lado do título, que abre as configurações: cadastro de categorias
   (nome e cor), aba de conexões (apps e chave da Claude), skills instaladas, rotinas,
   e o cofre.

Mais o botão de pausar e retomar a órbita.

Os anéis crescem conforme enchem. Uma categoria com mais arquivos ocupa mais espaço
angular, e o cinturão engrossa em sub-anéis. Não precisa ficar simétrico; precisa
ficar legível e com cada camada claramente identificada.

## Acceptance Criteria

1. `docker compose up` sobe o sistema e a tela principal abre em `localhost`, com os
   cinco anéis desenhados e o núcleo ao centro.
2. Criar uma categoria pela engrenagem, com nome e cor, gera a pasta no disco, o
   `SKILL.md` da ponte e um anel visível na cor escolhida.
3. Copiar 50 arquivos variados (pdf, docx, md, xlsx) para uma pasta de categoria faz
   50 pontos aparecerem na tela em menos de 60 segundos, sem recarregar a página.
4. Copiar o mesmo arquivo duas vezes com nomes diferentes resulta em um ponto, não dois.
5. Buscar por um conceito que não aparece literalmente em nenhum arquivo retorna o
   arquivo semanticamente relacionado entre os três primeiros resultados.
6. Hover num ponto com ligações desenha as linhas e esmaece os demais em menos de 100 ms.
7. Clicar abre a pré-visualização com a contagem correta de conectados e a lista
   completa ao expandir.
8. A varredura marca como sensível um arquivo com dado bancário ou documento, mostra
   isso na pré-visualização, e registra a marca no índice. No v1 ela **marca e avisa**,
   não cifra: o cofre saiu para o v2, e a interface precisa dizer isso sem rodeio.
9. _(v2)_ Cofre: ativar com senha e reiniciar o container deixa o conteúdo ilegível no
   disco e na API sem a senha; recusar o cofre faz o programa nunca mais perguntar.
10. Apagar `index.db` e reiniciar reconstrói o índice inteiro a partir das pastas, com
    a mesma contagem de arquivos e de categorias.
11. Um POST em `/api/v1/arquivos` com token do Hub cria o arquivo em `consultoria/`,
    e ele aparece no anel com as ligações explícitas já desenhadas.
12. O mesmo token recebe 403 ao tentar ler qualquer arquivo de outra categoria.
13. O painel de uso de modelo mostra números reais acumulados de `uso_modelo`.
14. O pause congela a órbita e o play retoma, sem redesenhar a cena.
15. Testes escritos e passando. Sem degradação de funcionalidade existente.

## Child Issues

| # | Título | Prioridade | Esforço (humano / CC) | Depende de |
|---|--------|-----------|----------------------|-----------|
| 1 | Esqueleto Docker, SQLite, migrações, config | Crítica | 1 dia / 45 min | — |
| 2 | Categorias: CRUD, pasta, SKILL.md da ponte, cor | Crítica | 1 dia / 40 min | 1 |
| 3 | Watcher (`chokidar`) + fila + extração de texto por biblioteca | Crítica | 1 dia / 45 min | 1, 2 |
| 4 | Skill de varredura: hash, dedup, classificação, dado sensível | Alta | 2 dias / 1h30 | 3 |
| 5 | Embeddings locais (`transformers.js`) + busca (`sqlite-vec`) | Alta | 0,5 dia / 25 min | 3 |
| 6 | Grafo de ligações: explícitas gravadas, descobertas por `sqlite-vec` | Alta | 0,5 dia / 25 min | 5 |
| 7 | UI orbital: 5 anéis, dados reais, WebSocket | Crítica | 3 dias / 2h | 2, 3, 6 |
| 8 | UI: hover com grafo, clique com lista de conectados | Alta | 1,5 dia / 1h | 7 |
| 9 | Configurações: categorias, conexões, skills, rotinas, pause | Média | 2 dias / 1h30 | 2, 7 |
| ~~10~~ | ~~Cofre: opt-in, senha opcional, cripto, fluxo de uso~~ | **v2** | 2 dias / 1h30 | 4 |
| 11 | Executor de skills (SKILL.md) + chamadas à Claude + contagem de uso | Alta | 2 dias / 1h30 | 1, 2 |
| ~~12~~ | ~~Rotinas agendadas + log de execução~~ | **v2** | 1 dia / 40 min | 11 |
| 13 | API HTTP v1 + tokens com escopo por categoria | Crítica | 1,5 dia / 1h | 1, 2, 5 |
| ~~14~~ | ~~Apps: cadastro, atalhos clicáveis, MCP~~ | **v2** | 1,5 dia / 1h | 9 |
| ~~15~~ | ~~Monitoramento: RAM, disco, CPU, índice~~ | **v2** | 0,5 dia / 20 min | 7 |

**Total do v1: cerca de 16,5 dias** de equipe humana, ou algo entre 11 e 12 horas de
execução assistida. As quatro issues riscadas saem para o v2 (decisão 2af872eb) e
somam os 5 dias restantes. Nenhuma delas bloqueia a tela orbital ou a integração
com o Hub.

**Correção de estimativa (revisão CEO).** Quando a decisão de fundação foi
apresentada, a economia projetada era de 24 para 10 dias. Esse número pressupunha
adotar um aplicativo pronto inteiro, caminho que a restrição de licença fecha. Com
bibliotecas, a economia real é de 2,5 dias: as bibliotecas resolvem a mecânica
(observar pastas, gerar vetores, buscar por similaridade), mas a cola entre elas,
a fila, o tratamento de erro e os testes continuam sendo trabalho nosso.

A decisão continua certa, porque reimplementar busca vetorial à mão seria pior em
qualquer cenário. Mas ela não é o corte de escopo que o plano precisa. Se 21,5 dias
for demais para a primeira entrega, o corte tem que vir do escopo do produto, não
da fundação. Candidatos naturais para um v2: rotinas agendadas (#12), apps e
atalhos (#14), monitoramento de sistema (#15) e o cofre (#10), que juntos somam
cerca de 5 dias e nenhum deles bloqueia o Hub.

## Dependency Graph

```
#1 Esqueleto ─┬─> #2 Categorias ─┬─> #3 Watcher ──> #4 Varredura ──> #10 Cofre
              │                  │        │
              │                  │        └──> #5 Embeddings ──> #6 Grafo
              │                  │                                    │
              │                  └──> #11 Executor ──> #12 Rotinas    │
              │                                                       │
              └──> #13 API ─────────────────────────────────────┐     │
                                                                 │     │
                        #7 UI orbital <──────────────────────────┴─────┘
                             ├──> #8 Hover e grafo
                             ├──> #9 Configurações ──> #14 Apps
                             └──> #15 Monitoramento
```

## Sequencing Rationale

A ingestão vem antes da interface porque uma tela bonita sem dados reais engana a
revisão: tudo parece funcionar até o primeiro arquivo de verdade entrar. Categorias
vêm logo depois do esqueleto porque toda a organização em disco depende delas, e
mudar isso depois significa mover arquivo. O cofre vem depois da varredura porque é
ela que descobre o que é sensível. A API entra cedo mesmo sem o Hub existir, porque
é o contrato que impede retrabalho quando o segundo programa começar.

## Testing Plan

| Camada | O quê | Qtd |
|--------|-------|-----|
| Unit | hash e dedup, derivação de chave do cofre, cálculo de arestas, parser de SKILL.md, roteamento de categoria | +18 |
| Integração | ingestão ponta a ponta por tipo de arquivo, reconstrução do índice, escopo de token na API, ciclo do cofre | +12 |
| E2E | criar categoria e ver o anel, soltar arquivos e ver os pontos, hover e grafo, POST do Hub virando ponto | +6 |

Teste de regressão obrigatório: o token do Hub recebe 403 em toda categoria que não
seja `consultoria`. Esse é o teste que protege os dados pessoais dela.

## Rollback Plan

Os arquivos nunca são tocados destrutivamente pelo sistema: a ingestão lê e escreve
no índice, não reescreve o original. Rollback de versão é voltar a imagem Docker
anterior e reindexar. Rollback de migração do banco é apagar `index.db` e reindexar,
porque o banco é derivado. O único estado não reconstruível é o conteúdo do cofre,
que precisa de backup próprio e de aviso claro para ela na ativação.

## Files Reference

| Arquivo | O que faz |
|---------|-----------|
| `docker-compose.yml` | um serviço, volume para `~/second-brain` |
| `src/db/schema.sql` | o schema acima |
| `src/ingest/watcher.ts` | observa as pastas, enfileira |
| `src/ingest/pipeline.ts` | varredura, extração, embedding, arestas |
| `src/ingest/extract/*.ts` | um extrator por tipo de arquivo |
| `src/skills/runner.ts` | lê SKILL.md, executa, conta uso |
| `src/skills/categoria-ponte.ts` | a skill que cada categoria ganha |
| `src/vault/crypto.ts` | Argon2id, selar e abrir |
| `src/api/v1/*.ts` | rotas e middleware de escopo por token |
| `src/ui/orbital/engine.ts` | derivado de `variant-a.html` já aprovado |
| `src/ui/orbital/graph.ts` | hover, arestas, esmaecer |
| `config.yaml` | chave da Claude, cofre, pastas |

## Out of Scope

- O Hub de Diagnóstico, que tem spec próprio e vem depois.
- Adiados para o v2 por decisão de escopo (2af872eb), não por rejeição: cofre
  criptografado, rotinas agendadas, atalhos de aplicativos e MCP, e o painel de
  monitoramento de sistema. O lugar deles na tela continua reservado: o anel de
  Rotinas e o de Apps aparecem vazios até o v2, o que é o comportamento correto
  também para uma instalação nova.
- Ler skills ou conectores da conta claude.ai da Jessica, que a documentação oficial
  confirma não ser possível entre superfícies.
- Multiusuário. O Second Brain é de uma pessoa só.
- App móvel.
- Integração automática com Instagram, já fora de escopo no documento da Jessica.
- Módulo de perfil comportamental (16Personalities), idem.

## Pendências que não bloqueiam o início

1. **Consentimento LGPD** do Hub precisa ser específico sobre a análise de perfil
   gerada para a mentora. Vale meia hora de advogado antes do Hub ir ao ar, não antes
   do Second Brain.
2. **Texto da interface do cofre** precisa dizer com precisão o que a opção sem senha
   protege e o que não protege.
3. **Qual modelo de embedding** exatamente, a decidir na issue #5 por medição em
   português, não por reputação.
## Review record
