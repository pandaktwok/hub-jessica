---
spec_version: 1
project: hub-jessica
component: hub-diagnostico
status: draft
date: 2026-10-08
author: Pandaktwok + Claude (/spec, modo desatendido)
fonte: "Hub de Diagnostico - Especificacao Funcional.pdf" (13 páginas, Jessica Zock)
depende_de: SPEC-second-brain-v1.md
---

# ÉPICO — Hub de Diagnóstico v1

## Context

Hoje o diagnóstico inicial da mentoria acontece ao vivo, no Encontro 1, com a Jessica
conduzindo as perguntas e sintetizando as respostas na hora. Funciona, e funciona bem,
mas só escala na velocidade da agenda dela.

O Hub digitaliza essa conversa. A mentorada preenche seis blocos, cada um aciona uma
geração de IA que se alimenta dos blocos anteriores, e o resultado consolida no **Mapa
de Diagnóstico**, exportável em PDF. É o entregável central da primeira fase da mentoria,
e substitui o relatório que a Jessica escreve à mão depois de cada Encontro 1.

O Hub é o segundo dos dois programas. O Second Brain (spec próprio, já revisado) é a
base; o Hub grava tudo que produz na categoria `mentoria` de lá e não tem banco de
conhecimento próprio.

**O que o PDF da Jessica diz é regra, não sugestão.** Onde este spec e o PDF divergirem,
o PDF vence. Isso inclui o tom, o glossário de palavras proibidas e a proibição absoluta
de conteúdo clínico.

## Current State

Projeto `hub-jessica`, em `/home/claude/hub-jessica`. Verificado em 2026-10-08:

| O que existe | Estado |
|---|---|
| `SPEC-second-brain-v1.md` | Fechado, revisado pela CEO, 11 issues no v1 |
| `board/` | Protótipo da tela orbital, variante Carta Celeste aprovada |
| PDF da especificação funcional | 13 páginas, fonte deste spec |
| Código do Hub | Nenhum. Greenfield. |

O Second Brain também ainda não tem código. A primeira versão deste spec dizia que "as
issues #1 a #5 do Second Brain precisam estar de pé antes da issue #6 daqui", e isso
estava errado: a issue #6 depende da #3, #4 e #5 **deste** programa. Quem depende do
Second Brain é só a #8 (publicação), via SB#13. Com a #8 no fim da fila, o Hub é
construível e vendável sem o outro programa presente.

### Decisões herdadas (travadas, não relitigar)

| ID | O que fixa |
|---|---|
| `60a0cb74` | O Hub fala com o Second Brain por HTTP, token escopado só em `mentoria`. Fora disso é 403. |
| `7bd5b096` | Toda dependência precisa de licença permissiva. O produto é vendido e roda em rede; copyleft de rede está fora. |
| `a0c9d3c7` | Carta Celeste é a direção visual de todas as telas do produto. |
| `2af872eb` | O v1 do Second Brain não tem cofre. Consequência para cá: dado sensível é marcado, não cifrado. |

## Suposições deste spec (modo desatendido)

O trabalho foi delegado sem alguém presente para responder. Onde o PDF e as decisões
travadas não bastaram, tomei a leitura mais razoável e marquei aqui. Qualquer uma pode
ser revertida sem retrabalho estrutural.

| # | Suposição | Por quê | Custo de reverter |
|---|---|---|---|
| S1 | Banco próprio em **Postgres**, não SQLite | O Hub é multiusuária com escritas concorrentes de várias mentoradas ao mesmo tempo; SQLite serve o Second Brain porque ele é de uma pessoa só | Baixo, se feito antes da primeira mentorada real |
| S2 | Entrada por **link mágico no e-mail**, sem senha | Público não técnico, uso esporádico ao longo de 6 meses; senha esquecida vira suporte para a Jessica | Baixo |
| S3 | Prompts em **arquivos versionados no disco**, editáveis por uma tela do admin | O PDF exige editável fora do código; arquivo em disco dá histórico de graça e combina com "pastas são a verdade" | Médio |
| S4 | PDF gerado por **render de HTML**, reaproveitando os tokens da Carta Celeste | Mesma identidade visual do resto do produto, sem um segundo sistema de layout | Baixo |
| S5 | O Hub tem **banco próprio** para respostas e gerações, e grava no Second Brain só o resultado consolidado | Respostas cruas de formulário não são "memória"; o que vira memória é o diagnóstico pronto | Médio |
| S6 | Uma mentorada = **um diagnóstico ativo**; refazer um módulo cria nova geração, não novo diagnóstico | O PDF fala em refazer módulos ao longo de 6 meses mantendo histórico | Baixo |

## Proposed Change

Aplicação web em Docker, exposta na internet com HTTPS, onde as mentoradas entram por
link e a Jessica entra como admin.

### Os seis módulos, como o PDF define

| # | Módulo | Base teórica | Entradas | Saída para a mentorada |
|---|---|---|---|---|
| 1 | Diagnóstico de Cliente Ideal | StoryBrand | 7 perguntas | Cartão de persona: nome fictício, dor, desejo, frase de posicionamento, vocabulário-chave |
| 2 | Mapa de Forças e Ativos | — | 6 perguntas | Lista de 3 a 5 diferenciais, frase para bio, alerta de lacunas |
| 3 | Nome do Método | Arquétipos de marca | 3 perguntas | 5 a 10 nomes com justificativa, mais esqueleto de 3 a 5 etapas |
| 4 | Precificação Sugerida | Precificação por valor | 5 perguntas | Tabela: valor atual x sugerido, com o raciocínio (ver a ressalva abaixo) |
| 5 | Protocolos e Ofertas | Value Proposition Design | 3 perguntas | 2 a 3 formatos de pacote, ligados às faixas do módulo 4 |
| 6 | Posicionamento em Redes | — | 4 perguntas | Bio sugerida, 3 a 5 destaques, 3 a 4 pilares de conteúdo, recomendação de constância |

**Ressalva do módulo 4, achada na revisão.** A primeira versão pedia "faixa de mercado"
na tabela e nenhum dos dois specs tem fonte para isso. Sem fonte, o modelo inventaria
faixas de preço de serviços médicos no Brasil e o produto apresentaria o número numa
tabela para uma médica que vai precificar o trabalho dela em cima. Isso também encosta na
regra do PDF que proíbe promessa de resultado financeiro.

A coluna sai da v1. Fica valor atual e valor sugerido, com o raciocínio em cima das
respostas dela. Se a Jessica tiver ou quiser montar uma base de referência, ela volta como
dado dela, citado como dela, e aí é dependência de conteúdo e não de software.

Falta decidir uma coisa junto: **quem calcula o número**. O plano de teste prevê teste
unitário do "cálculo do valor-hora do módulo 4", o que pressupõe código determinístico; o
fluxo de dados diz que o módulo volta como JSON do modelo. São coisas diferentes e importa
qual é: código é testável e defensável, geração não é nenhum dos dois. A decisão deste
spec é **código calcula o número, o modelo escreve o raciocínio** — a aritmética de
valor-hora não é trabalho de modelo de linguagem.

Cada módulo alimenta os seguintes. O módulo 4 cruza persona (1) e diferenciais (2) para
calcular a margem sugerida. O 5 se liga às faixas do 4. O 6 usa o vocabulário do 1.

### Fluxo de dados (os 5 passos do PDF, seção 6)

```
1. formulário do módulo N
      ↓ respostas salvas por mentorada
2. monta o prompt: instrução fixa de tom (seção 5) + respostas do módulo N
                   + contexto já gerado nos módulos 1..N-1 da MESMA mentorada
      ↓
3. chamada ao LLM pedindo retorno em JSON estruturado
      ↓
4. valida o formato, exibe para a mentorada
      ↓ aceitar / editar à mão / gerar de novo
5. ao fechar o módulo 6: nova chamada gera o resumo executivo
   e os "próximos 3 passos", consolidando o Mapa de Diagnóstico
```

Depois que a mentorada **aceita** um módulo, o resultado sobe para a categoria
`mentoria` do Second Brain. Rascunho e geração descartada não sobem.

### O system prompt é construído, não escrito à mão

As sete diretrizes da seção 5 do PDF viram um cabeçalho fixo em **todas** as chamadas,
mais o glossário do anexo como regra de substituição. O texto fica em
`prompts/_sistema.md`, editável pela Jessica sem nova versão do programa.

Regras que entram literalmente: português do Brasil; nunca as palavras "vendas",
"comercial", "plano de saúde", "mentoria em grupo", e sim "crescimento", "posicionamento",
"serviços de saúde", "acompanhamento"; tom consultivo, direto e prático, nunca genérico;
ancorar sempre em respostas literais da mentorada; sem frases de efeito vazias nem
promessa de resultado financeiro; **nunca** procedimento, conduta, protocolo clínico ou
diagnóstico de saúde; tudo editável pela mentorada antes de entrar no relatório.

### Duas verificações, com políticas opostas

A primeira versão deste spec juntava as duas numa única issue (#4) e dava a ambas a
política do glossário: regenerar uma vez, e se insistir **mostrar assim mesmo** e
registrar, "porque esconder a saída seria pior que mostrar um texto que ela pode editar".

Esse raciocínio está certo para palavra proibida e é perigoso para conteúdo clínico.
"Mostrar assim mesmo" aplicado a uma sugestão de conduta significa o produto exibindo
conduta clínica para uma médica, numa ferramenta que a mentora dela vendeu, com uma linha
de log como único controle. O PDF diz que a IA **nunca** deve sugerir procedimento,
protocolo clínico ou conduta de saúde, e "nunca" não admite política de degradação.

| | Glossário (4 palavras) | Conteúdo clínico |
|---|---|---|
| Natureza | lista fechada, mecanicamente testável | classe aberta, semântica |
| Achou | regenera uma vez | regenera uma vez |
| Insistiu | **mostra e registra** | **bloqueia, não exibe, avisa a Jessica** |
| O que a mentorada vê | o texto, que ela pode editar | "este trecho precisa de revisão da Jessica antes de aparecer" |
| Onde fica | `glossario_ok` | `clinico_ok` |

São duas issues separadas, não uma. A do glossário é barata e determinística. A clínica é
a cara, e o spec a subestimava: não dá para garantir classe aberta com um teste de uma
entrada adversária, como o critério 6 fazia. Precisa de um corpo de entradas adversárias
construído de propósito, com as formulações que uma médica usaria de verdade ("meu
procedimento X, tecnicamente o que você acha?"), e a política de bloqueio é o que torna
a garantia honesta mesmo quando a detecção falha em alguma formulação nova.

O glossário também vale para **texto fixo da interface**, não só para saída de IA. A
regra travada proíbe as quatro palavras em todo texto do produto, e o critério 5 só
cobria a saída do modelo.

### O assistente responde completo

A seção 5 proíbe soar vendedor pressionando. Então o assistente não segura resposta:
entrega inteiro o que foi perguntado, e o que vende o acompanhamento é a profundidade
aplicada ao caso dela, não escassez.

**Correção da primeira versão deste spec.** A versão anterior mandava o assistente dizer,
sempre que o assunto passasse do escopo do módulo, uma frase fixa: "isso é o princípio;
aplicar no teu consultório, com a tua agenda e o teu ticket, é o que o acompanhamento
faz". Essa frase estava errada por quatro motivos e foi removida. Ela segura resposta e
pendura uma oferta no lugar, que é exatamente o que a seção 5 proíbe e o que esta seção
diz estar evitando. Usa "ticket", jargão do registro que o PDF veta. Está escrita em
*tu* enquanto o resto do produto fala *você*. E, sendo uma frase obrigatória, apareceria
igual no Mapa de toda mentorada, o que é a primeira coisa que faria dois Mapas ficarem
indistinguíveis e derrubaria o critério 25.

**No lugar dela, uma regra sem frase pronta.** Quando o assunto passa do escopo do
módulo, o assistente responde o que sabe, até onde o módulo alcança, e diz o que ficou
fora **nomeando o assunto concreto**, não a oferta: "a parte de como isso entra na tua
agenda semanal não está neste módulo". Nunca "isso eu não te conto", e nunca uma frase
fixa. Quem decide quando mencionar o acompanhamento é a Jessica, na conversa com ela, não
o produto num texto automático.

### Contrato com o Second Brain

O Hub é cliente, nunca servidor, dessa relação. Token Bearer escopado em `mentoria`.

```
POST /api/v1/arquivos
  { categoria: "consultoria",
    nome: "Diagnóstico — <mentorada> — Módulo 4 — v2.md",
    conteudo: "<markdown do módulo aceito>",
    ligacoes_explicitas: ["<id do módulo 1>", "<id do módulo 2>"] }
  -> 201 { id, caminho }

GET /api/v1/busca?q=<termo>&cat=consultoria
  -> usado pelo assistente para achar material da Jessica sobre o tema
```

As ligações explícitas são o que faz o grafo do Second Brain mostrar que o módulo 4
nasceu do 1 e do 2. Sem elas, a reconstrução do índice perde a origem.

#### Os critérios 11 e 12 se contradiziam

A primeira versão deste spec pedia duas coisas que não podem valer juntas. O critério 11
manda publicar o módulo com as ligações explícitas corretas. O critério 12 manda a
mentorada concluir o diagnóstico inteiro com o Second Brain desligado. Se ele cai durante
o módulo 1 e volta no 4, o `sb_arquivo_id` do módulo 1 ainda é nulo quando o 4 entra na
fila: não existe id para ligar.

A correção é dizer o que o spec nunca dizia, que é **quando a carga útil é montada**. Ela
é montada **na hora de drenar**, não na hora de enfileirar. A fila guarda a referência à
geração local; as ligações são resolvidas no momento do envio, lendo os
`sb_arquivo_id` que já existirem. Isso exige o que a tabela não tinha: ordem por módulo
dentro de um mesmo diagnóstico, um item que só sai depois que os módulos de que ele
depende saíram, e estado explícito por item.

Se o Second Brain nunca voltar, as ligações nunca são perdidas, porque não foram gravadas
nulas: o item continua esperando.

#### Respostas de erro, que o contrato não tinha

O contrato do Second Brain documentava `201` e mais nada. Ele tem um índice único por
hash de conteúdo, e o Hub pode mandar conteúdo byte a byte igual (duas mentoradas com
saída curta no módulo 3, ou um aceite de novo depois de uma edição que não mudou nada).
Isso bate no índice e a resposta era indefinida, caindo fora dos dois ramos da fila.

| Resposta | O que significa | O que o Hub faz |
|---|---|---|
| 201 | publicado | grava `sb_arquivo_id`, item concluído |
| 409 | conteúdo idêntico já existe | usa o id devolvido no corpo, item concluído, sem duplicar |
| 422 | carga inválida (categoria errada, ligação inexistente) | para o item, acusa no admin: é defeito de programa |
| 401, 403 | token ausente, inválido ou fora de escopo | para a fila inteira, `/healthz` acusa, e-mail para a Jessica: é erro de instalação |
| 429, 5xx, timeout | indisponibilidade | continua na fila, nova tentativa com espera crescente |

O 409 precisa devolver o id do arquivo existente no corpo, senão o Hub não tem como
fechar o item. **Isso é uma emenda ao spec do Second Brain**, não só a este, e está
anotada lá.

**Degradação quando o Second Brain está fora.** O Hub continua funcionando: salva no
banco próprio e enfileira a publicação. A mentorada não vê diferença. A Jessica vê um
aviso no admin. O que não pode acontecer é o diagnóstico dela travar porque o outro
programa caiu.

#### O que o Second Brain entrega ao Hub na v1, com honestidade

Vale dizer em voz alta, porque muda a ordem de construção. O Hub tem banco próprio
(suposição S5) e o critério 12 diz que a mentorada conclui tudo com o Second Brain
desligado sem notar. Então, na v1, o que o Second Brain dá ao Hub é: o ponto aparecendo na
constelação, e a busca `GET /busca?cat=consultoria` para o assistente achar material da
Jessica. Essa busca aparecia uma vez, num bloco de código, sem critério de aceite, sem
issue filha e sem linha no plano de teste.

Isso não é argumento para juntar os dois programas: a fronteira de token escopado continua
sendo a decisão travada e a certa. É argumento para a issue #8 (publicação) ser a
**última** coisa construída, e não um bloqueio no meio do caminho, e para o Hub ser
vendável e instalável sem Second Brain presente. O lado de leitura precisa de critério e
de issue própria, ou sai do v1 declaradamente.

### Schema (Postgres)

```sql
CREATE TABLE mentoradas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL,
  email           text NOT NULL UNIQUE,
  status          text NOT NULL DEFAULT 'ativa'
                  CHECK (status IN ('ativa','pausada','concluida')),
  iniciou_em      timestamptz NOT NULL DEFAULT now(),
  consentimento_versao  text NOT NULL,
  consentimento_em      timestamptz NOT NULL,
  consentimento_perfil  boolean NOT NULL, -- aceite específico da análise para a mentora
  consentimento_ia      boolean NOT NULL, -- aceite do envio a provedor de IA no exterior
  perfil_revogado_em    timestamptz,      -- revogação do aceite da análise
  excluir_em            timestamptz       -- pedido de exclusão (art. 18), carência de 30 dias
);

-- Autenticação. A primeira versão deste spec não tinha nenhuma tabela para isso,
-- apesar de o link mágico ser um portador que fica meses na caixa de entrada dela.
CREATE TABLE links_acesso (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorada_id uuid NOT NULL REFERENCES mentoradas(id) ON DELETE CASCADE,
  token_hash   bytea NOT NULL UNIQUE,     -- hash, nunca o token em claro
  expira_em    timestamptz NOT NULL,      -- 30 minutos
  usado_em     timestamptz,               -- uso único
  criado_em    timestamptz NOT NULL DEFAULT now(),
  ip_pedido    inet
);
CREATE INDEX idx_link_mentorada ON links_acesso(mentorada_id, criado_em DESC);

CREATE TABLE sessoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorada_id uuid NOT NULL REFERENCES mentoradas(id) ON DELETE CASCADE,
  token_hash   bytea NOT NULL UNIQUE,
  expira_em    timestamptz NOT NULL,      -- 14 dias, renovada em uso
  criado_em    timestamptz NOT NULL DEFAULT now()
);

-- As perguntas são conteúdo editável igual aos prompts, e estavam só no código.
CREATE TABLE perguntas (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo    smallint NOT NULL CHECK (modulo BETWEEN 1 AND 6),
  campo     text NOT NULL,                -- chave estável, nunca muda
  rotulo    text NOT NULL,                -- o que a mentorada lê, editável
  exemplo   text,                         -- o exemplo real que aparece no campo vazio
  ordem     smallint NOT NULL,
  obrigatoria boolean NOT NULL DEFAULT true,
  ativa     boolean NOT NULL DEFAULT true,
  UNIQUE (modulo, campo)
);

CREATE TABLE diagnosticos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorada_id  uuid NOT NULL REFERENCES mentoradas(id) ON DELETE CASCADE,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  concluido_em  timestamptz
);
CREATE UNIQUE INDEX um_diagnostico_ativo
  ON diagnosticos(mentorada_id) WHERE concluido_em IS NULL;

CREATE TABLE respostas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostico_id uuid NOT NULL REFERENCES diagnosticos(id) ON DELETE CASCADE,
  modulo         smallint NOT NULL CHECK (modulo BETWEEN 1 AND 6),
  campo          text NOT NULL,
  valor          text NOT NULL,
  salvo_em       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (diagnostico_id, modulo, campo),
  FOREIGN KEY (modulo, campo) REFERENCES perguntas(modulo, campo)
);

CREATE TABLE geracoes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostico_id uuid NOT NULL REFERENCES diagnosticos(id) ON DELETE CASCADE,
  modulo         smallint NOT NULL CHECK (modulo BETWEEN 1 AND 6),
  -- versao vinha de código, com UNIQUE embaixo: dois cliques de "gerar de novo"
  -- corriam pelo 2 e um tomava violação de unicidade DEPOIS de pagar a chamada.
  -- Agora o banco distribui o número.
  versao         integer NOT NULL DEFAULT nextval('seq_versao_geracao'),
  conteudo       jsonb,                   -- nulo enquanto estado = 'gerando'
  conteudo_editado jsonb,
  estado         text NOT NULL DEFAULT 'gerando'
                 CHECK (estado IN ('gerando','rascunho','aceita','descartada','falhou')),
  -- prompt_versao era text e não identificava prompt em camadas (ver issue #17):
  -- depois da edição dela, "qual prompt" é padrão de fábrica + camada dela.
  prompt_hash    bytea NOT NULL,          -- hash do prompt composto, como foi enviado
  prompt_texto   text NOT NULL,           -- o prompt composto, consultável
  modelo         text NOT NULL,
  tokens_in      integer, tokens_out integer,
  custo_centavos integer,
  glossario_ok   boolean NOT NULL DEFAULT true,
  clinico_ok     boolean NOT NULL DEFAULT true,
  sb_arquivo_id  text,
  iniciado_em    timestamptz NOT NULL DEFAULT now(),
  concluido_em   timestamptz,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (diagnostico_id, modulo, versao)
);
CREATE SEQUENCE IF NOT EXISTS seq_versao_geracao;
CREATE INDEX idx_ger_diag ON geracoes(diagnostico_id, modulo);

-- As edições dela sobrescreviam umas às outras, enquanto o Rollback Plan dizia que
-- geracoes era append-only. Era falso. Agora o histórico existe de verdade.
CREATE TABLE edicoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geracao_id  uuid NOT NULL REFERENCES geracoes(id) ON DELETE CASCADE,
  conteudo    jsonb NOT NULL,
  editado_em  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE perfis (                     -- a análise que a Jessica usa, LGPD
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostico_id uuid NOT NULL REFERENCES diagnosticos(id) ON DELETE CASCADE,
  padroes        jsonb NOT NULL,          -- padrões derivados, nunca resposta crua
  gerado_em      timestamptz NOT NULL DEFAULT now()
  -- visivel_para_mentorada foi removida. Ver a seção de LGPD: era o interruptor
  -- que escondia da titular uma análise sobre ela que o consentimento promete
  -- que ela pode ver a qualquer momento.
);
CREATE INDEX idx_perfis_diag ON perfis(diagnostico_id, gerado_em DESC);

CREATE TABLE fila_publicacao (            -- resiliência quando o SB está fora
  id          bigserial PRIMARY KEY,
  geracao_id  uuid NOT NULL UNIQUE REFERENCES geracoes(id) ON DELETE CASCADE,
  modulo      smallint NOT NULL,         -- ordem de drenagem dentro do diagnóstico
  diagnostico_id uuid NOT NULL REFERENCES diagnosticos(id) ON DELETE CASCADE,
  estado      text NOT NULL DEFAULT 'pendente'
              CHECK (estado IN ('pendente','enviando','concluido','parado')),
  tentativas  integer NOT NULL DEFAULT 0,
  proxima_tentativa timestamptz NOT NULL DEFAULT now(),
  ultimo_erro text,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fila_drenar ON fila_publicacao(estado, proxima_tentativa)
  WHERE estado = 'pendente';
```

O `UNIQUE` em `geracao_id` na fila impede item duplicado se um caminho de nova tentativa
enfileirar duas vezes, que criaria dois arquivos no Second Brain para a mesma geração.

### LGPD, em concreto

O consentimento no cadastro é **específico**, não um "aceito os termos" genérico. Caixas
separadas, cada uma com texto próprio, e as duas últimas não bloqueiam o uso do Hub:

1. Uso dos dados do negócio dela para gerar o diagnóstico.
2. Armazenamento do diagnóstico para revisitar aos 3 e aos 6 meses.
3. **Envio das respostas a um provedor de inteligência artificial, com o nome do provedor
   e o país.** Esta caixa é nova, ver abaixo, e sem ela não há diagnóstico.
4. Geração de uma **análise de padrões** sobre a forma de trabalhar dela, para a Jessica
   usar no acompanhamento. O texto diz isso com essas palavras, e diz que ela pode ver
   a análise a qualquer momento e revogar este item sem perder o resto.

A tabela `perfis` guarda **padrões derivados**, nunca cópia das respostas. A versão do
texto fica em `consentimento_versao`, porque quando o texto mudar é preciso saber quem
aceitou qual.

#### A incoerência que a revisão achou

A versão anterior recusava ferramenta de análise de terceiros dizendo que é "dado de
paciente da mentorada dela e não sai do servidor", e ao mesmo tempo mandava as respostas
em texto livre dela para um provedor de IA no exterior, que é o mecanismo central do
produto. As três caixas não mencionavam isso em lugar nenhum.

O provedor de IA é **operador** no sentido da LGPD, e o envio é transferência
internacional. Isso precisa estar escrito no consentimento, com o nome do provedor e o
país, e precisa ser caixa própria, porque é finalidade distinta das outras. Junto com
isso, o formulário avisa, no próprio campo, para ela não escrever dado que identifique
paciente, porque o PDF pede o negócio dela e não o prontuário de ninguém.

#### Revogação, retenção e exclusão, que não existiam

| O que | Como fica |
|---|---|
| Revogar a análise de padrões | Botão no acesso dela. Grava `perfil_revogado_em` e apaga as linhas de `perfis`. O resto do diagnóstico continua |
| Retenção | Respostas e gerações por 24 meses após a conclusão; depois, apagadas por rotina. O Mapa exportado é dela e fica com ela |
| Exclusão a pedido (art. 18) | Botão no acesso dela. Grava `excluir_em` com 30 dias de carência, avisa a Jessica, e a rotina apaga em cascata |
| Portabilidade | O export do Mapa em PDF e um JSON com as respostas dela, pelo acesso dela, sem pedir à Jessica |

A primeira versão dizia "guardar o perfil derivado em vez dos dados brutos". Isso era
verdade da tabela `perfis` e falso do banco: `respostas` guardava toda resposta crua para
sempre. A retenção acima é o que faz a frase passar a ser verdade.

#### A coluna que foi removida

`perfis.visivel_para_mentorada` saiu. O único uso dela era esconder da titular uma
análise sobre ela, enquanto o texto de consentimento promete que ela pode ver a qualquer
momento. Construir o interruptor que quebra a própria promessa é pior que não ter o
interruptor: se um dia a Jessica precisar de exceção, isso se decide com advogado e muda
o texto do consentimento, não com uma coluna no banco.

**Isto não é parecer jurídico.** Meia hora de advogado antes do Hub receber a primeira
mentorada real continua sendo necessária, e está na lista de pendências. O que mudou é
que agora há o que mostrar ao advogado.

### Interface

#### Reversão parcial proposta da decisão a0c9d3c7 (precisa do seu aval)

A Carta Celeste foi aprovada para a constelação do Second Brain, onde fundo azul-noite
é o céu e os pontos brilham contra ele. O Hub pede outra coisa: quarenta minutos de
leitura e digitação, feita por uma médica entre atendimentos, muitas vezes no celular.
Texto claro sobre fundo escuro em sessão longa cansa a vista e derruba a velocidade de
leitura; serifada de display em corpo de formulário piora.

**Proposta:** a Carta Celeste continua sendo a identidade, aplicada onde ela funciona,
e o corpo do formulário inverte.

| Superfície | Tratamento |
|---|---|
| Boas-vindas, transições entre módulos, capa do Mapa | Carta Celeste integral: `#0B1220`, Spectral, dourado `#E8C978` |
| Corpo do formulário e campos | Fundo claro `#F7F4EE`, texto `#1C2231`, medida de 60 a 70 caracteres |
| Texto gerado pela IA na tela de revisão | Fundo claro, com a faixa dourada identificando que aquilo é rascunho |
| Mapa exportado em PDF | Capa em Carta Celeste, miolo claro, porque ela vai imprimir e mostrar |
| Painel admin | Carta Celeste integral: uso curto e recorrente, onde o escuro funciona |

A marca continua reconhecível na abertura, no fecho e em cada transição. O que muda é
só onde o olho fica parado por minutos.

**Se você preferir manter tudo escuro**, é reversível: são tokens, não estrutura. O
custo é legibilidade em sessão longa, e o sintoma aparece como abandono no módulo 3 ou 4,
não como reclamação.

#### Hierarquia por tela (Pass 1)

```
BOAS-VINDAS            REVISÃO DE MÓDULO           MAPA DE DIAGNÓSTICO
─────────────          ─────────────────           ───────────────────
1 o que ela recebe     1 "isto é um rascunho"      1 resumo executivo
2 quanto leva          2 o texto gerado            2 próximos 3 passos
3 pode parar e voltar  3 aceitar / editar          3 as 6 seções
4 começar              4 gerar de novo             4 exportar
```

Na tela de revisão a ordem é deliberada e contraria o instinto de mostrar primeiro o
resultado. O PDF da Jessica insiste que o conteúdo é rascunho qualificado, não verdade
fechada. Se o texto da IA aparecer antes do enquadramento, ela lê como veredito e aceita
sem revisar, que é exatamente o que o documento quer evitar. O aviso não é um banner
genérico: é uma linha curta, em dourado, com o nome dela ("Jessica vai revisar isso com
você; ajuste o que não soar como você").

#### Estados de interação (Pass 2)

| Tela | Carregando | Vazio | Erro | Sucesso | Parcial |
|---|---|---|---|---|---|
| Formulário | — | campo com exemplo real, nunca "digite aqui" | campo marcado com o que falta, em texto, não só vermelho | "salvo" discreto ao lado do campo | rascunho retomável, com a data da última vez |
| Geração | ver abaixo | — | "não consegui gerar agora; suas respostas estão salvas" + repetir | o texto aparece de uma vez, sem efeito de digitação | se o JSON vier quebrado: regenera uma vez calado, depois mostra o erro |
| Mapa | barra com as 6 seções sendo montadas | impossível: só monta com os 6 prontos | mostra as seções que deram certo e qual falhou | — | — |
| Admin | esqueleto da tabela | "nenhuma mentorada ainda" + como convidar | — | — | mentorada que parou no meio aparece com o módulo e a data |

**Os 30 segundos de geração são a tela mais importante do produto.** Não pode ser um
círculo girando. Enquanto gera, a tela mostra o que ela acabou de responder, em texto
dela, com uma linha dizendo o que está sendo montado a partir daquilo ("lendo o que você
contou sobre a cliente que já atende"). Ela relê o próprio material em vez de encarar um
vazio, e a espera deixa de ser tempo morto. Se passar de 45 segundos, aparece o botão de
cancelar; nada é perdido.

#### Arco emocional (Pass 3)

| # | O que ela faz | O que sente | O que a tela faz por isso |
|---|---|---|---|
| 1 | Abre o link | Curiosidade com um pé atrás: mais um formulário | Mostra o entregável antes de pedir qualquer coisa |
| 2 | Lê o consentimento | Desconfiança, é onde se desiste | Três frases curtas, uma por caixa, sem parede de texto |
| 3 | Responde o módulo 1 | Exposta: está falando de cliente de verdade | Exemplos reais no campo, nenhuma pergunta obrigatória sem motivo |
| 4 | Espera a geração | Ansiedade: será que entendeu? | Vê as próprias palavras sendo lidas |
| 5 | Lê o resultado | Alívio ou decepção, e isso decide o resto | O rascunho enquadrado antes, o texto depois, o botão de editar do lado |
| 6 | Chega no módulo 4 (preço) | Vulnerável: vai dizer quanto cobra | O módulo que mais exige vem depois de três resultados bons |
| 7 | Recebe o Mapa | Orgulho, se funcionou | Exportar em destaque; é o que ela mostra para alguém |

Horizontes: nos primeiros 5 segundos ela precisa entender o que vai receber; nos 5
minutos, sentir que o sistema leu o que ela escreveu; em 6 meses, voltar e ver o quanto
mudou. O histórico versionado já serve o terceiro, e nenhuma tela o aproveita ainda.
Fica anotado como oportunidade do v2, não como lacuna do v1.

#### Risco de texto genérico de IA (Pass 4)

As três superfícies pedem registros diferentes: o formulário é ferramenta (OPERATE), o
Mapa é leitura (READ), e só as boas-vindas vendem algo (PERSUADE). Erro comum é escrever
as três como se fossem a terceira.

As quatro palavras proibidas já estão nos critérios. Falta o resto, que é onde o texto de
IA se entrega:

**Na interface.** Nenhum microcopy de assistente genérico: sem "Vamos começar essa jornada
juntos", sem "Incrível!" depois de um campo preenchido, sem emoji em botão. Rótulo é
substantivo, botão é verbo, erro diz o que fazer.

**Na saída da IA.** Proibido abrir com "Com base nas suas respostas" ou "Analisando o seu
perfil" — ela sabe que respondeu, o preâmbulo só gasta a atenção dela. A persona começa
pelo nome fictício. Proibido o fecho motivacional ("Você está no caminho certo!"): o PDF
pede conteúdo aplicável, e elogio sem conteúdo é exatamente o jargão de guru que ela
proibiu. Proibida a estrutura de três bullets com negrito no começo de cada um quando o
conteúdo é um raciocínio, porque transforma análise em lista decorativa.

**No Mapa.** Nenhuma seção pode ser escrita de modo que sirva para qualquer mentorada. O
teste é concreto e vira critério: tirar o nome do Mapa de uma mentorada e o Mapa de outra,
dar os dois para a Jessica e pedir que diga qual é de quem. Se ela não conseguir, o prompt
falhou, não o desenho.

Essas regras entram nos arquivos de prompt como restrições explícitas, não como estilo
sugerido, e o `_sistema.md` versionado é onde moram.

#### Responsivo e acessibilidade (Pass 6)

Antes um "é responsivo" solto, o que na prática entrega o desktop espremido.

**Celular (até 480px).** É o caso principal, não a exceção: ela preenche entre consultas.
Uma pergunta por tela, não o módulo inteiro rolando. Avançar e voltar fixos no rodapé,
acima do teclado. Alvo mínimo de 44px. Barra de progresso vira "3 de 7" em texto, porque
barra fininha some em tela pequena.

**Tablet e desktop (768px+).** Módulo inteiro em coluna única de 60 a 70 caracteres, com
o progresso dos seis módulos numa trilha lateral.

**Acessibilidade, requisitos verificáveis.** Rótulo visível sempre, nunca placeholder
como único rótulo, porque some quando ela digita. Contraste mínimo de 4.5:1 no corpo e
3:1 em elemento de interface, válido nas duas superfícies (clara e escura). Navegação
completa por teclado, com foco visível em dourado de 2px, e sem armadilha de foco no
diálogo de consentimento. Fim de geração anunciado por região viva para leitor de tela,
já que a mudança acontece sem clique. Corpo de texto nunca abaixo de 16px, inclusive no
celular, onde abaixo disso o iOS dá zoom sozinho ao focar o campo.

#### As telas

Boas-vindas com o que ela vai receber e quanto leva; os seis blocos em sequência com
progresso e salvamento automático; a revisão por módulo; o Mapa consolidado; e o painel
admin da Jessica.

O admin lista as mentoradas com o estágio de cada uma, abre qualquer diagnóstico, mostra
a análise de padrões, e tem a tela de edição dos prompts. O PDF diz que a integração com
a Central da Mentora no Notion não é obrigatória no v1; o que é obrigatório é o modelo de
dados permitir, e permite, por exportação JSON e pela API de leitura.

### Operação e instalação (revisão de DX)

Este spec foi escrito como se o programa fosse rodar na máquina de quem o escreveu. Ele
vai ser vendido e rodar na VPS que a Jessica contrata. Isso muda quem é o usuário técnico
do produto, e o spec original não tinha nenhum dos dois:

| Persona | Quem é | O que precisa fazer |
|---|---|---|
| Instalador | A Jessica, ou um técnico que ela paga por um dia | Subir o produto numa VPS limpa e entrar no admin |
| Editora de prompts | A Jessica, sozinha, meses depois | Mudar o comportamento da IA sem quebrar o produto |
| Integrador | Você, hoje; uma integração com o Notion, depois | Consumir a API e diagnosticar o que falhou |

Se instalar for difícil, você faz toda instalação à mão para sempre, e isso come a margem
do produto. O alvo é 15 minutos de uma VPS vazia até o login no admin.

#### Dois achados que mudam decisões

**1. Os prompts estão em dois lugares que vão colidir.** A suposição S3 põe os prompts em
arquivos versionados no repositório. A issue #13 dá à Jessica um editor de prompts no
admin. As duas estão certas sozinhas e se atropelam juntas: no primeiro `docker compose
pull` para a v1.1, a atualização passa por cima de tudo que ela editou, sem avisar.

Correção: o arquivo versionado é o **padrão de fábrica**; a edição dela é uma **camada
guardada no banco**, aplicada por cima. A atualização troca o padrão e nunca encosta na
camada dela. O admin mostra os dois e um botão de voltar ao padrão. Custo pequeno agora,
porque a issue #13 ainda não existe; custo alto depois, porque seria perda de trabalho
dela em produção.

**2. A fila resiliente esconde erro de configuração.** O critério 12 manda a fila acumular
quando o Second Brain está fora. Correto para queda temporária, errado para token com
escopo errado: um 403 por token mal configurado ficaria em nova tentativa para sempre, e
ninguém descobre. 403 e 401 são erro de instalação, não de rede: param a fila, aparecem no
`/healthz` e no admin, e avisam a Jessica. 5xx e timeout continuam na fila.

#### Erros que a Jessica precisa entender sem você

Três caminhos de erro, do jeito que ela vai encontrar:

| O que quebrou | O que o spec fazia | O que passa a fazer |
|---|---|---|
| Chave do modelo recusada | Mentorada vê "não consegui gerar"; Jessica não sabe de nada | Admin diz: "A chave do modelo não está sendo aceita. Troque em Configurações." E-mail para ela |
| Token do Second Brain com escopo errado | Fila tenta de novo para sempre, calada | Fila para, `/healthz` acusa, admin nomeia o problema |
| Postgres fora no boot | Container reinicia em laço, sem mensagem legível | Log em uma linha em português dizendo qual variável está errada |

Nenhuma dessas telas mostra rastro de pilha. Todas nomeiam o lugar onde se arruma.

#### O que isso acrescenta

Modo `LLM_MODE=stub` com respostas de arquivo, para desenvolver e testar o fluxo inteiro
sem gastar API e sem resposta diferente a cada rodada. Hoje cada rodada de teste ponta a
ponta custa dinheiro e não é determinística, o que na prática significa que ninguém roda.

Custo por geração gravado em `geracoes` (a API devolve isso de graça) e total do mês no
admin. A Jessica paga o modelo e, sem isso, recebe a fatura sem saber de onde veio. O
painel de uso do modelo já existe nos mockups aprovados do Second Brain, então é a mesma
linguagem.

Funil de abandono por módulo, montado sobre as datas que já estão no schema. A revisão de
design apontou o abandono no meio do caminho como o maior risco do produto; sem medir, a
correção é chute. Nada de ferramenta de análise de terceiros: é dado de paciente da
mentorada dela e não sai do servidor.

Pré-visualização antes de salvar no editor de prompts, rodando contra um conjunto de
respostas de exemplo guardado. Sem isso, cada edição dela é uma mudança em produção sem
teste, e o histórico de versões que o spec já prevê só serve para descobrir o estrago
depois. Com o histórico pronto, voltar atrás é quase de graça.

### Assistente de primeiro acesso (9 etapas)

Isto não existia em nenhum dos dois specs e é o que torna o produto instalável por quem
comprou. A revisão de DX achou o buraco pelo lado da instalação; a revisão de engenharia
achou pelo lado do token (o modelo de segurança inteiro depende de um token escopado que
nenhuma tela do sistema sabia emitir). As duas respostas são a mesma tela: este assistente.

**Formato.** Barra de progresso de 1 a 9, uma etapa por tela, cada uma concluída fica
marcada e dá para voltar. Desenho clássico e discreto, paleta pastel sobre fundo claro,
sem enfeite — o registro de consultório, não o de painel de controle. A constelação do
Second Brain continua na Carta Celeste escura; o assistente e os formulários ficam claros,
que é onde se lê e se digita.

| # | Etapa | Quem é dona | O que acontece |
|---|---|---|---|
| 1 | Conta | Second Brain | E-mail e senha da Jessica. Primeiro acesso cria a conta de administradora, sem script |
| 2 | Onde guardar | Second Brain | Pasta na máquina, Google Drive ou disco da VPS. Testa escrita e leitura na hora |
| 3 | Conectar a IA | Second Brain | A conta de IA dela. Faz uma chamada de teste e mostra o resultado |
| 4 | As skills | Second Brain | Tenta listar da IA conectada; se não der, ensina ela a pedir a lista para a IA e colar aqui |
| 5 | Categorias | Second Brain | As fixas já vêm criadas; ela adiciona as dela (outra empresa, por exemplo) com cor |
| 6 | Varredura dos arquivos | Second Brain | Opcional, pode pular. Acha repetido, separa pessoal de profissional, marca o sensível |
| 7 | Seu perfil de mentora | Hub | Nome, marca e como a assistente se apresenta. Ver abaixo: isto tira o nome do código |
| 8 | Os textos de consentimento | Hub | Ela escreve as caixas, com explicação de cada uma e de onde aparece |
| 9 | Conectar o Hub | os dois | O Second Brain emite o token escopado, ela cola no Hub, o assistente confirma |

#### A etapa 4, que é a que tem truque

O ideal é o programa ler as skills direto da conta de IA dela. Isso pode não ser possível,
porque depende de a conta expor isso. Então a etapa tem dois caminhos e ela nunca fica
travada: se a leitura automática funcionar, as skills aparecem numa lista com caixas para
ela escolher quais registrar; se não funcionar, a tela mostra a frase pronta para ela
copiar e colar na própria IA ("liste todas as skills que você tem disponíveis, uma por
linha"), e ela cola a resposta de volta. O programa usa a IA que ela acabou de conectar na
etapa 3 para transformar aquele texto colado no banco de skills, do mesmo jeito que o
Second Brain faz com o resto.

Skill registrada por referência continua valendo como skill ativa na constelação: o
Second Brain sabe que ela existe e o que faz, mesmo sem ter o arquivo dela.

#### A etapa 5 e uma coisa que ficou ambígua

Nas categorias: quando ela pedir para a IA guardar algo no Second Brain, o programa
**pergunta em qual categoria** em vez de escolher sozinho. Isso é dela.

Você falou "a categoria é a mentoria, a mentoria pessoal" e o spec, desde a decisão
travada `60a0cb74`, chama a categoria que o Hub escreve de `mentoria`. Pode ser só jeito
de falar, mas também pode ser que o nome certo seja outro, e esse nome está no token e nos
403 — trocar depois mexe nos dois programas. Está na lista de pendências para você
confirmar numa palavra: o Hub escreve em `mentoria` ou em `mentoria`?

#### A etapa 7 resolve um problema que a revisão achou

"Jessica" estava escrito dentro do produto: no texto da tela de revisão, nas sete
diretrizes do `_sistema.md`, no glossário. Se outra mentora comprar, o nome dela, a voz
dela e as diretrizes dela são conteúdo de instalação, não código. A etapa 7 transforma
isso em configuração, com o material da Jessica como padrão de fábrica — a mesma
arquitetura de camadas da issue #17, aplicada ao perfil em vez de ao prompt.

Isso levanta uma pergunta de negócio que nenhum dos dois specs responde, e não é minha
para responder: **o conteúdo deste produto é a metodologia de uma mentora.** Vender para
outras médicas que fazem mentoria é vender o método de posicionamento dela. Se isso é
licenciamento, marca branca ou problema, é decisão sua e da Jessica, e ela fica acima da
história de instalação, da camada de prompts e da decisão de inquilino. Anotada como
pendência, sem palpite meu.

#### A etapa 8, do jeito que você pediu

Ela escreve os textos, não você nem eu. A tela explica, antes de cada campo, o que aquela
caixa autoriza e em que lugar do produto aquilo acontece, em português comum: a primeira é
usar as respostas para gerar o diagnóstico; a segunda é guardar para revisitar aos 3 e aos
6 meses; a terceira é mandar as respostas para a IA, dizendo qual provedor e em que país; a
quarta é gerar a análise de padrões para a mentora. Cada campo vem com um rascunho que ela
pode reescrever inteiro, porque página em branco trava e rascunho destrava.

Ao salvar, o texto ganha versão (`consentimento_versao`), e a partir daí fica registrado
quem aceitou qual redação. Enquanto a etapa 8 não estiver concluída, o Hub não aceita
cadastro de mentorada — não é possível cadastrar alguém sob um consentimento que ainda não
existe.

#### Consequência de arquitetura, que contraria um pouco o que você descreveu

Você descreveu um assistente só. Do lado dela é um só: nove etapas, uma barra, começo e
fim. Por dentro ele não pode ser um programa só, e o motivo é o token.

As etapas 1 a 6 configuram armazenamento, IA, skills e categorias — isso é o Second Brain
inteiro, não a categoria `mentoria`. Se o Hub hospedasse essas telas, ele precisaria de
um acesso muito maior que o token escopado, e a decisão `60a0cb74` (fora de `mentoria` é
403) deixaria de valer justamente na tela de configuração, que é o pior lugar para abrir
exceção.

Então: **as etapas 1 a 6 rodam no Second Brain, as 7 e 8 no Hub, e a 9 é a emissão do token
de um lado e a colagem do outro.** A barra de progresso é compartilhada e a passagem é
guiada, com botão. Do ponto de vista dela, muda uma colagem de token. Do ponto de vista da
segurança, é o que mantém a fronteira em pé.

## Acceptance Criteria

1. Uma mentorada abre o link do e-mail e chega na tela de boas-vindas sem senha.
2. O cadastro mostra as três caixas de consentimento separadas, com o texto da análise de
   padrões escrito por extenso, e grava a versão do texto aceito.
3. Preencher o módulo 1 e fechar o bloco gera o cartão de persona em menos de 30 segundos,
   com os campos do PDF: nome fictício, dor, desejo, frase de posicionamento, vocabulário.
4. A saída do módulo 4 cita explicitamente um dado do módulo 1 e um do módulo 2, provando
   que o contexto acumulado chegou no prompt.
5. Nenhuma saída de nenhum módulo contém "vendas", "comercial", "plano de saúde" ou
   "mentoria em grupo". Teste automatizado sobre as quatro palavras e suas flexões.
6. Nenhuma saída contém recomendação clínica. Teste com entradas que convidam a isso
   (uma mentorada descrevendo um procedimento e pedindo opinião técnica).
7. Editar o texto gerado e aceitar preserva a edição: `conteudo_editado` guarda o que ela
   deixou, `conteudo` guarda o que a IA produziu, e o relatório usa a edição.
8. Gerar de novo o módulo 3 cria `versao = 2` e mantém a versão 1 consultável.
9. Fechar o módulo 6 monta o Mapa com as oito seções do PDF na ordem, incluindo resumo
   executivo e os próximos 3 passos.
10. O Mapa exporta em PDF com a identidade visual da marca, e o arquivo abre no Acrobat e
    no visualizador do Chrome sem fonte quebrada.
11. Aceitar um módulo publica o arquivo na categoria `mentoria` do Second Brain com as
    ligações explícitas corretas, e o ponto aparece na constelação.
12. Com o Second Brain desligado, a mentorada conclui o diagnóstico inteiro sem erro; a
    fila acumula e drena sozinha quando ele volta.
13. O token do Hub recebe 403 ao tentar ler qualquer categoria que não seja `mentoria`.
14. A mentorada A não alcança nenhum dado da mentorada B por URL adivinhada, por API nem
    por export.
15. A Jessica abre o admin e vê, para cada mentorada, em que módulo está e quando mexeu
    pela última vez.
16. Editar `prompts/_sistema.md` pelo admin muda o comportamento da próxima geração sem
    reiniciar o container, e a geração registra qual versão do prompt usou.
17. Testes escritos e passando. Sem degradação do que já existe.

Acrescentados pela revisão de design:

18. Durante a geração, a tela mostra as respostas que a mentorada acabou de dar e o que
    está sendo montado a partir delas. Nenhum estado de carregamento é só um girador. Passando
    de 45 segundos aparece cancelar, e cancelar não perde resposta.
19. Na tela de revisão, o enquadramento de rascunho aparece acima do texto gerado na ordem
    do DOM, não só visualmente, e é lido primeiro por leitor de tela.
20. Fluxo completo possível só com teclado, em celular e desktop, com foco visível em todo
    elemento interativo e sem armadilha de foco no diálogo de consentimento.
21. Contraste de 4.5:1 no corpo e 3:1 em elemento de interface, verificado nas duas
    superfícies (clara no formulário, escura nas transições), por teste automatizado.
22. No celular, uma pergunta por tela, alvos de pelo menos 44px, corpo de texto nunca abaixo
    de 16px, e o rodapé de navegação acima do teclado virtual.
23. Fim da geração anunciado por região viva, porque a tela muda sem a mentorada clicar.
24. Nenhuma saída de IA abre com preâmbulo do tipo "com base nas suas respostas" nem fecha
    com elogio sem conteúdo. Teste automatizado sobre a lista de aberturas e fechos vetados.
25. Teste de identificabilidade do Mapa: dois Mapas de mentoradas diferentes, sem nome, são
    atribuídos corretamente pela Jessica. É um teste manual, feito uma vez antes de liberar.
26. Rascunho retomável mostra a data da última mexida, e a mentorada que parou no meio
    aparece no admin com o módulo e a data.

Acrescentados pela revisão de DX:

27. Numa VPS limpa com Docker, `docker compose up -d` sobe o produto, roda as migrações
    sozinho e permite o login no admin em menos de 15 minutos, sem nenhum comando de SQL
    à mão. Cronometrado uma vez numa máquina nova antes de liberar.
28. `.env.example` lista toda variável com explicação e valor padrão onde existir. Subir
    sem uma variável obrigatória falha na partida com a mensagem dizendo qual falta.
29. `/healthz` responde o estado de cada dependência separado: banco, modelo, Second
    Brain. Com o modelo fora, diz que é o modelo.
30. O primeiro acesso cria a conta de administradora da Jessica por um assistente na tela,
    sem script de seed.
31. Erro 401 ou 403 do Second Brain para a fila, aparece no `/healthz` e no admin e dispara
    e-mail para a Jessica. Erro 5xx e timeout continuam na fila como antes.
32. Prompt editado pela Jessica fica numa camada no banco. Simulação de atualização de
    versão (trocar o arquivo de fábrica) preserva a edição dela, e o botão de voltar ao
    padrão restaura o arquivo de fábrica.
33. O editor de prompts pré-visualiza a geração contra um conjunto de respostas de exemplo
    antes de salvar.
34. `LLM_MODE=stub` roda o fluxo completo dos seis módulos com respostas de arquivo, sem
    chamar API. Os testes ponta a ponta usam esse modo.
35. Cada geração grava tokens e custo, e o admin mostra o total do mês.
36. O admin mostra, por módulo, quantas mentoradas entraram e quantas concluíram.
37. A versão do produto aparece no admin.

Acrescentados pelo assistente de primeiro acesso:

38. Numa instalação nova, o primeiro acesso abre o assistente na etapa 1 e não deixa
    chegar ao resto do produto antes das etapas obrigatórias. A 6 pode ser pulada.
39. A barra mostra em qual das 9 etapas ela está, marca as concluídas, e dá para voltar e
    corrigir qualquer etapa já feita.
40. A etapa 2 confirma o armazenamento escrevendo e lendo um arquivo de teste no destino
    escolhido, e falha com mensagem nomeando o destino quando não consegue.
41. A etapa 3 faz uma chamada de teste à IA conectada e mostra a resposta. Chave inválida
    diz que é a chave, não "erro inesperado".
42. A etapa 4 funciona nos dois caminhos: lista automática quando a conta expõe, e colagem
    de texto quando não expõe. O caminho manual usa a IA da etapa 3 para montar o banco de
    skills, e skill registrada por referência aparece como ativa na constelação.
43. A etapa 5 vem com as categorias fixas criadas e aceita categoria nova com cor. Pedido
    de guardar algo pela IA pergunta a categoria em vez de escolher sozinho.
44. A etapa 7 grava nome e marca da mentora, e nenhuma tela nem prompt do produto traz
    nome de mentora escrito em código.
45. Com a etapa 8 incompleta, o Hub recusa cadastro de mentorada. Concluída, o texto ganha
    versão e passa a ser o que fica gravado em `consentimento_versao`.
46. A etapa 9 emite um token escopado só na categoria do Hub, e o assistente confirma a
    ligação fazendo uma chamada real de ida e volta antes de marcar a etapa como concluída.
47. Token emitido na etapa 9 recebe 403 em qualquer categoria fora do escopo, testado pelo
    próprio assistente e mostrado como verificado na tela.

## Child Issues

### Issue #0 — a que faltava, e vem antes de tudo

| # | Título | Prioridade | Esforço | Depende de |
|---|--------|-----------|---------|-----------|
| 0 | Escrever e calibrar os seis prompts à mão, com 3 mentoradas reais | Crítica | 3 a 5 dias, humano, não comprime | PDF + Jessica |

A primeira versão deste spec listava `prompts/modulo-{1..6}.md` e `prompts/_sistema.md`
apenas na referência de arquivos. A issue #3 construía o motor que monta os prompts, a #4
o verificador, a #13 e a #17 o editor. **O conteúdo dos prompts não tinha issue, nem
estimativa, nem responsável.** E o conteúdo dos prompts é o produto: o resto é encanamento
em volta dele.

Pior que isso, o critério 25 (dois Mapas sem nome, atribuídos corretamente pela Jessica) é
um teste de qualidade de prompt e estava marcado para rodar "uma vez antes de liberar",
isto é, depois dos 31 dias. Isso inverte a ordem do risco. A suposição mais arriscada do
programa inteiro é "um diagnóstico de posicionamento escrito por IA sai específico o
bastante para uma médica pagar por ele", e ela estava sendo validada por último, por um
teste manual, sem nenhum plano para o caso de falhar.

**Essa validação pode ser feita hoje, à mão, numa janela de conversa, com três mentoradas
reais, antes de existir uma linha de código.** Se a saída sair genérica, todo o resto —
link mágico, fila, prompts em camadas, dois temas — é investimento perdido. Se sair boa,
os prompts calibrados entram como o padrão de fábrica da #3 e o risco maior do projeto
morre na primeira semana, de graça.

### As issues de construção

| # | Título | Prioridade | Esforço (humano / CC) | Depende de |
|---|--------|-----------|----------------------|-----------|
| 1 | Esqueleto Docker, Postgres, migrações, config | Crítica | 1 dia / 1h | — |
| 16 | Instalação em um comando, `.env.example`, `/healthz`, assistente de primeiro acesso | Crítica | 2 dias / 1 dia | 1 |
| 2 | Cadastro, link mágico com expiração e uso único, sessão, consentimento | Crítica | 3 dias / 4h | 1, texto do consentimento |
| 3 | Motor de prompts: montagem com contexto acumulado e orçamento de tokens | Crítica | 2,5 dias / 3h | 1, 0 |
| 4a | Verificador de glossário (saída de IA + texto fixo da interface) | Alta | 1 dia / 1h | 3 |
| 4b | Barreira de conteúdo clínico, com corpo adversário e política de bloqueio | Crítica | 2,5 dias / 1 dia | 3 |
| 5 | Formulário dos 6 módulos, uma pergunta por tela no celular, salvamento | Crítica | 4 dias / 5h | 2, 15 |
| 6 | Geração por módulo: chamada, estado `gerando`, limite de concorrência, 429 | Crítica | 3 dias / 4h | 3, 4a, 4b, 5 |
| 7 | Revisão: aceitar, editar com histórico, gerar de novo | Alta | 1,5 dia / 2h | 6 |
| 11 | Análise de padrões, revogação, retenção, exclusão (LGPD) | Alta | 2 dias / 3h | 6 |
| 9 | Mapa de Diagnóstico: consolidação e as 8 seções | Crítica | 2 dias / 3h | 6 |
| 10 | Export PDF com a marca | Alta | 1,5 dia / 4h | 9 |
| 12 | Painel admin: lista, status, saúde, custo, funil | Alta | 2,5 dias / 3h | 2, 9 |
| 17 | Prompts em camadas (fábrica + camada no banco) e pré-visualização | Alta | 1,5 dia / 2h | 3, 12 |
| 18 | Modo stub do modelo, custo por geração, funil de abandono | Alta | 1,5 dia / 2h | 6 |
| 19 | Assistente de primeiro acesso, etapas 7 e 8 (perfil da mentora, textos de consentimento) | Crítica | 2 dias / 3h | 1, 16 |
| 14 | Auditoria de isolamento entre mentoradas, sobre toda superfície | Crítica | 1,5 dia / 3h | 5, 10, 12 |
| 8 | Publicação no Second Brain + fila com resolução na drenagem | Alta | 2 dias / 3h | 6, SB#13 |

### Emendas que o assistente exige no spec do Second Brain

As etapas 1 a 6 e a emissão do token na 9 são do outro programa. Elas não existem no spec
dele e precisam entrar antes de ele ser construído:

| Etapa | O que falta no spec do Second Brain | Esforço |
|---|---|---|
| 1 | Conta de administradora criada no primeiro acesso, sem seed | 0,5 dia |
| 2 | Destino de armazenamento configurável: pasta local, Google Drive ou disco da VPS | 2,5 dias |
| 3 | Conexão da conta de IA dela, com chamada de teste | 1 dia |
| 4 | Importação de skills: automática quando possível, colagem guiada quando não | 2 dias |
| 5 | Pergunta de categoria no momento de guardar (a tela de categorias já estava prevista) | 0,5 dia |
| 6 | Varredura de arquivos: repetido, pessoal x profissional, marcação do sensível | 3 dias |
| 9 | **Emissão de token escopado por categoria, com tela.** A SB#13 criava o conceito de token escopado e nenhuma tela para emitir um | 1 dia |
| — | A barra de progresso compartilhada e a passagem guiada para o Hub | 1 dia |

**Mais 12,5 dias no Second Brain**, que passa de 16,5 para 29 dias. A etapa 2 e a 6 são as
caras: guardar em Google Drive em vez de pasta local muda a camada de arquivo inteira do
programa, e a varredura é a que mexe em arquivo de verdade dela.

O spec do Second Brain está fechado e revisado pela CEO, então essas emendas entram lá por
uma revisão própria, não por mim escrevendo em cima. Elas estão listadas aqui para a conta
do programa inteiro não ficar mentindo.

A issue #13 foi **absorvida pela #17**. Como estava, a #13 construía um editor que mexe em
arquivo e a #17 reconstruía como camada no banco — a #17 dependia da #13 e desfazia o
trabalho dela. O argumento de que a camada era barata era justamente que "a #13 ainda não
existe"; então ela não deve passar a existir primeiro.

**Total: cerca de 37 dias** de equipe humana para o Hub, mais 3 a 5 dias de calibragem de
prompt que não comprimem, mais 29 dias do Second Brain com as emendas do assistente.
**O programa inteiro passa de 69 dias.** A primeira versão deste spec dizia 24.

### A coluna de horas assistidas estava errada, e vale dizer como

Na primeira versão, toda issue comprimia na mesma proporção, por volta de 11 para 1: 1
dia virava 45 minutos, 2 dias viravam 1h30, 3 dias viravam 2h, em dezoito issues de
natureza completamente diferente. Isso não é estimativa, é conversão de unidade.

Algumas coisas não comprimem porque são presas ao relógio e a olho humano: verificar
contraste em dois temas em aparelho de verdade, conferir se a fonte do PDF abre no Acrobat
e no Chrome, cronometrar 15 minutos de instalação numa VPS nova, e calibrar prompt lendo a
saída e decidindo se presta. A tabela acima foi reestimada issue por issue, e as que não
comprimem aparecem com a razão perto de 1 para 1 ou em dias.

## Dependency Graph

```
#0 PROMPTS À MÃO, com 3 mentoradas reais  ← semana 1, antes de qualquer código
   │  (se a saída sair genérica, o projeto para aqui, barato)
   v
#1 Esqueleto ─┬─> #16 Instalação em um comando
              │
              ├─> #2 Cadastro + consentimento ──────────┐  (precisa do texto
              │       (links_acesso, sessoes)           │   do consentimento)
              │                                         │
              └─> #3 Motor de prompts ─┬─> #4a Glossário┤
                                       └─> #4b Barreira │
                                           clínica ─────┤
                                                        │
                      #15 Desenho ─> #5 Formulário ─────┤
                                                        │
                                       #6 Geração <─────┘
                                          ├─> #7 Revisão
                                          ├─> #11 Análise de padrões + LGPD
                                          ├─> #18 Stub, custo, funil
                                          └─> #9 Mapa ─┬─> #10 PDF
                                                       └─> #12 Admin ─> #17 Prompts
                                                                        em camadas
                            #14 Auditoria de isolamento  ← depois de 5, 10 e 12
                            #8 Publicação no SB ← por último (SB #13 API)
```

## Sequencing Rationale

**#0 primeiro, e isso é a mudança mais importante que as revisões produziram.** A
suposição mais arriscada do projeto é a qualidade da saída, e ela custa três a cinco dias
para testar à mão, hoje, sem software. Tudo o mais depende dela valer.

O motor de prompts (#3) vem antes da geração (#6) porque o PDF exige que o tom seja
configurável fora do código, e descobrir isso depois significa reescrever todas as
chamadas. As duas verificações (#4a e #4b) vêm antes da geração pelo mesmo motivo: são
baratas como porta de saída, caras como remendo.

**#15 antes de #5, não depois.** A revisão de design pedia uma pergunta por tela no
celular e barra de navegação acima do teclado. Isso é estrutura de navegação do
formulário, não tema: construir o formulário em rolagem única e depois reestruturar é
construir duas vezes. A estimativa original da #15 (2,5 dias) assumia que era só trocar
tokens, o que valia para a inversão de tema e não para o roteamento por pergunta.

**#14 no fim, não no meio.** Estava cedo com a justificativa de que privacidade é crítica,
o que é verdade e levava à conclusão errada: o critério 14 cobre vazamento por URL, por
API e por export, e export é a #10 e admin é a #12. Rodar a auditoria depois da #5 audita
um terço da superfície e dá uma sensação falsa de cobertura. O isolamento vira **invariante
da camada de acesso a dados**, escrita na #1 e na #2 (toda consulta carrega o escopo da
mentorada, sem exceção), e a #14 passa a ser a auditoria final sobre tudo que existe.

**#11 solta da #9.** A análise de padrões derivava de `respostas` e `geracoes`, disponíveis
depois da #6, e estava presa atrás do Mapa sem motivo. É a parte com risco jurídico e
retrabalho possível: quanto mais cedo existir, mais cedo o advogado pode olhar.

**#8 por último.** A primeira versão dizia, na seção de estado atual, que "as issues #1 a
#5 do Second Brain precisam estar de pé antes da issue #6 daqui". Isso estava errado e
atrapalhava o cronograma inteiro: a #6 depende da #3, #4 e #5 **deste** programa e não tem
dependência nenhuma do Second Brain. Quem depende dele é a #8, via SB #13. Com a #8 no
fim, o Hub fica construível e vendável sem o Second Brain presente, e o outro programa
entra quando estiver pronto.

## Testing Plan

| Camada | O quê | Qtd |
|--------|-------|-----|
| Unit | montagem do prompt com contexto acumulado, verificador de glossário, cálculo do valor-hora do módulo 4, versionamento de geração | +22 |
| Integração | fluxo módulo a módulo com LLM mockado, aceitar/editar/regerar, publicação no SB, fila drenando após queda, export PDF | +14 |
| E2E | jornada completa de uma mentorada do link ao PDF; a Jessica vendo o status no admin; tentativa de acesso cruzado entre mentoradas | +5 |

Testes de regressão obrigatórios, que nunca podem ser removidos: as quatro palavras do
glossário não aparecem em nenhuma saída; nenhuma saída traz recomendação clínica; a
mentorada A não alcança dado da B; o token do Hub recebe 403 fora de `mentoria`.

## Rollback Plan

Versão: voltar a imagem Docker anterior. As migrações do Postgres são aditivas por regra,
nunca destrutivas, então a imagem antiga roda sobre o schema novo.

Dado da mentorada: `geracoes` é append-only por desenho. Uma geração ruim não apaga a
anterior, e voltar é mudar qual versão está aceita.

Prompt: o editor guarda histórico, e voltar é escolher uma versão anterior. Como cada
geração grava `prompt_versao`, dá para saber exatamente o que produziu cada texto.

## Files Reference

| Arquivo | O que faz |
|---|---|
| `docker-compose.yml` | app + postgres |
| `db/migrations/*.sql` | o schema acima, aditivo |
| `prompts/_sistema.md` | as 7 diretrizes + glossário, editável pela Jessica |
| `prompts/modulo-{1..6}.md` | instrução por módulo, com os campos de saída |
| `src/prompt/montar.ts` | junta sistema + módulo + contexto acumulado |
| `src/prompt/glossario.ts` | verificador das palavras proibidas e do limite clínico |
| `src/gerar/{modulo,mapa}.ts` | chamada ao LLM, validação do JSON, versionamento |
| `src/sb/cliente.ts` | cliente HTTP do Second Brain, com a fila |
| `src/mapa/pdf.ts` | render do Mapa com os tokens da Carta Celeste |
| `src/perfil/padroes.ts` | deriva padrões, nunca copia resposta crua |
| `src/auth/magic-link.ts` | entrada sem senha |
| `src/admin/*` | painel da Jessica |

## Out of Scope

Do PDF da Jessica, itens que ela já marcou:

- Qualquer conteúdo clínico, técnico ou de tratamento de saúde.
- Integração automática com Instagram. A leitura da bio é texto que a mentorada informa.
- Teste de perfil comportamental (16Personalities/MBTI). Ela aplica à mão, fora do Hub.

Deste spec:

- Integração com a Central da Mentora no Notion. O modelo de dados permite (export JSON
  e API de leitura), a integração em si fica para depois.
- Pagamento e cobrança dentro do Hub.
- Os cursos online e o assistente que aponta para o minuto do vídeo. Isso apareceu na
  conversa como visão de futuro e não está no PDF; entra quando os cursos existirem.
- Aplicativo móvel. A tela é responsiva, o que resolve o uso no celular.

## Pendências

### Resolvidas nesta sessão

1. **Base legal.** Contrato assinado antes do uso do aplicativo. Isso é base legal de
   verdade na LGPD (execução de contrato) e cobre o diagnóstico em si. Duas coisas ficam
   fora do que o contrato resolve sozinho e continuam dependendo de consentimento próprio:
   a análise de padrões para a mentora, que vai além do necessário para entregar o
   diagnóstico, e o envio das respostas ao provedor de IA no exterior, que tem regra
   própria. As caixas existem para esses dois. A meia hora de advogado continua valendo e
   agora tem o que olhar. Isto não é parecer jurídico.
2. **Modelo de IA por módulo:** medir na calibragem (issue #0) e deixar configurável por
   módulo. Como é a conta de IA dela que está conectada, o modelo precisa ser troçável na
   configuração de qualquer forma, e a calibragem à mão já roda os seis prompts — testar
   dois modelos ali não custa nada e substitui o palpite por medida.
3. **PDF do Mapa:** navegador invisível imprimindo o mesmo HTML (Playwright/Chromium,
   Apache 2.0, passa no filtro da decisão `7bd5b096`). Uma fonte só para tela e papel,
   porque o Mapa é o documento que ela imprime e mostra para outras pessoas, e layout
   refeito à mão descola do que ela aprovou na tela.
4. **Texto das caixas de consentimento:** escrito pela Jessica, na etapa 8 do assistente de
   primeiro acesso, com rascunho editável e explicação de onde cada caixa é usada.

### Abertas

5. **O nome da categoria.** O Hub escreve em `mentoria` (decisão `60a0cb74`) e você
   falou "mentoria". O nome está no token e nas respostas 403 dos dois programas; trocar
   depois mexe nos dois. Uma palavra resolve.
6. **A questão de licenciamento.** O conteúdo do produto é a metodologia da Jessica.
   Vender para outras mentoras é vender o método dela. Licenciamento, marca branca ou não
   vender para o mesmo nicho é decisão de negócio, e ela fica acima da etapa 7 do
   assistente, da camada de prompts e da decisão de inquilino único.

## Decisões do Renan — 2026-10-09

| # | Decisão | Consequência |
|---|---------|--------------|
| 1 | A calibragem dos prompts acontece **dentro da configuração inicial**, com a Jessica, módulo por módulo. Ela sobe a documentação dela e o sistema monta as skills a partir disso | A issue #0 deixa de ser trabalho à mão separado e vira a razão de existir do assistente. O assistente passa a ser a primeira coisa construída |
| 2 | Hub e Second Brain separados. O Second Brain entra depois, primeiro só como apoio; mais adiante assume como memória principal e importa o histórico | A issue #8 sai do v1. O Hub nasce autossuficiente, com banco próprio |
| 3 | Execução assistida, tudo por IA, Renan revisando. Design preliminar agora, reformulado depois. Prioridade é ambiente de teste online para a Jessica validar | Bloco de design separado e provisório. Nada de polimento visual antes do fluxo funcionar |
| 4 | A categoria chama `mentoria` | Substitui `mentoria` em todo o projeto, inclusive no escopo do token |
| 5 | Quatro provedores suportados: Gemini, Claude, ChatGPT (OpenAI) e Meta AI. Chave fornecida pelo Renan no início. Textos modulares por provedor | O consentimento cita os quatro. A camada de modelo tem quatro implementações |
| 6 | Retenção de 24 meses | Mantido |
| 7 | Armazenamento: pasta local e disco de VPS no v1 | Google Drive fica para depois |
| 8 | Varredura: só achar repetidos no v1 | Sem separar pessoal de profissional, sem marcar sensível |
| 9 | Carta Celeste escura na abertura, nas transições e na capa do Mapa; fundo claro no corpo do formulário e no texto gerado | Fecha a reversão parcial de `a0c9d3c7` |
| 10 | Nova funcionalidade: calculadora de custo e preço para a Jessica, com custo de VPS e de IA, margem líquida recalculada quando ela muda o preço, e sugestão de teste grátis de 15 dias | Escopo novo, ver pendência aberta sobre onde isso mora |
| 11 | V1 exclusivo da Jessica. Marca branca fica para uma versão futura ou produto derivado | A etapa de perfil da mentora continua valendo, porque barateia o futuro sem custar nada agora |
| 12 | Sem mais revisões. Segue para construção | CEO review e revisão do spec do Second Brain não rodam |

**Trial de 15 dias é escopo novo** e não estava em nenhuma versão deste spec: exige estado
de cobrança, data de início, bloqueio ao fim do período e o que acontece com os dados de
quem não converte. Está anotado e não estimado.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | não rodada neste spec |
| Outside Review | subagente nativo (Codex ausente) | Segunda opinião independente | 1 | issues_found | 15 achados, 13 aceitos, 2 corrigidos como fatos |
| Eng Review | `/plan-eng-review` | Arquitetura e testes | 1 | issues_open | 26 issues, 6 lacunas críticas |
| Design Review | `/plan-design-review` | Lacunas de UI/UX | 1 | issues_open | nota 3/10 → 8/10, 9 critérios novos |
| DX Review | `/plan-devex-review` | Experiência de quem instala e opera | 1 | issues_open | nota 2,6/10 → 8/10, instalação de "à mão" para 15 min |

**OUTSIDE COVERAGE:** Codex não instalado (`CODEX_MODE: not_installed`), então a voz
externa rodou pelo caminho nativo: subagente com contexto limpo, só leitura. Isso **não
conta como cobertura externa** — é o mesmo harness, e a identidade do modelo não é
conhecida. Cobertura externa de provedor diferente continua faltando. O gate de qualidade
externo do `/spec` também segue indisponível e nunca foi marcado como aprovado.

**CROSS-MODEL:** não aplicável — não houve revisão externa completada de outro provedor.

**VERDICT:** NENHUMA revisão está CLEAR. As três encontraram problemas estruturais e o
spec foi emendado, mas emenda não é aprovação: o spec saiu desta rodada reestruturado e
com a issue #0 (calibrar os prompts à mão) como pré-condição de tudo. Eng review segue
requerida antes de implementar. CEO review recomendada, porque o escopo passou de 24 para
69 dias e isso é decisão de produto, não de engenharia.

**UNRESOLVED DECISIONS:**
- O nome da categoria que o Hub escreve: `mentoria` (decisão travada `60a0cb74`) ou
  `mentoria` (como você falou). Está no token e nos 403 dos dois programas.
- Licenciamento: o conteúdo do produto é a metodologia de uma mentora, e vendê-lo para
  outras mentoras vende o método dela. Decisão de negócio, acima da etapa 7 do assistente.
- Inversão de tema no corpo do formulário da mentorada (reversão parcial de `a0c9d3c7`).
  O assistente de primeiro acesso já foi pedido em pastel sobre fundo claro, o que torna a
  proposta coerente, mas o formulário da mentorada continua sendo escolha sua.
