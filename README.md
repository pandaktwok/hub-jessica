# Hub de Diagnóstico

Plataforma de diagnóstico de posicionamento para mentoria médica. A mentorada responde
seis módulos, cada um gera um texto que ela revisa e edita, e no fim sai um Mapa de
Diagnóstico que ela leva consigo.

Roda em Docker. Postgres de banco. Sem dependência de serviço externo além do provedor
de inteligência artificial que a mentora conecta.

> **Estado.** O ciclo completo funciona ponta a ponta: a mentora configura, sobe o
> material dela, gera as skills, cadastra uma mentorada, manda o link, e a mentorada
> percorre os seis blocos até o Mapa. Falta o envio do link por e-mail, o PDF com o
> Chromium invisível, a cobrança e a integração com o Second Brain.

---

## Subir numa máquina nova

Precisa de Docker e Docker Compose. Mais nada.

```bash
git clone https://github.com/pandaktwok/hub-jessica.git
cd hub-jessica
cp .env.example .env
nano .env                 # preencha POSTGRES_PASSWORD
docker compose up -d --build
```

Abra `http://IP-DA-MAQUINA:3000`. Ele leva direto para a configuração inicial.

As migrações do banco rodam sozinhas na partida. Não existe comando de SQL para dar na mão.

### No Windows, com PowerShell

```powershell
git clone https://github.com/pandaktwok/hub-jessica.git
cd hub-jessica
Copy-Item .env.example .env
notepad .env              # preencha POSTGRES_PASSWORD
docker compose up -d --build
```

Para gerar uma senha de banco:

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

---

## A configuração inicial, em nove etapas

| # | Etapa | O que acontece |
|---|-------|----------------|
| 1 | Sua conta | Cria a conta de administradora. Sem script de seed |
| 2 | Conectar a IA | Escolhe o provedor e faz uma chamada de teste de verdade antes de aceitar |
| 3 | Onde guardar | Escreve e lê um arquivo de teste no caminho escolhido antes de aceitar |
| 4 | Suas skills | Lista automática quando dá, colagem guiada quando não dá. Opcional |
| 5 | Categorias | `mentoria` e `mentoria pessoal` já vêm criadas; dá para acrescentar outras |
| 6 | Seu perfil | Nome, marca e como a assistente se apresenta. Nada disso fica escrito no código |
| 7 | Módulos e material | **A etapa que importa.** Por módulo, ela sobe o material dela e ajusta as instruções da IA |
| 8 | Consentimento | Ela escreve os quatro textos. Sem isso, o Hub recusa cadastro de mentorada |
| 9 | Custos e preço | Calculadora de custo de servidor, custo de IA e margem |

A etapa 7 é a calibragem: é ali que a inteligência artificial aprende a escrever no tom
da mentora, a partir do material que ela sobe. Tudo o mais é encanamento em volta disso.

---

## A consultoria

Depois da configuração, em `/admin/mentoradas` a mentora cadastra uma mentorada e gera um
link de acesso. O link vale 30 minutos e um acesso só; depois que ela entra, a sessão dura
duas semanas. O envio por e-mail ainda não está ligado, então por enquanto é copiar e
mandar pelo canal que já se usa com ela.

A mentorada percorre seis blocos. Em cada um:

1. Responde as perguntas daquele bloco, com salvamento automático e exemplo real em cada
   campo. Pode parar e voltar.
2. Ao concluir, vê a tela de geração — que mostra **as próprias respostas dela** enquanto
   o rascunho é montado, em vez de um girador. Passando de 45 segundos aparece a saída.
3. Lê o rascunho, com o aviso de que é rascunho **acima** do texto na ordem do documento,
   não só visualmente.
4. Edita o que não soar como ela, ou pede outro rascunho. O que vale é a versão dela.

Cada bloco carrega o contexto dos anteriores, com orçamento de tamanho para o módulo 6 não
estourar o tempo. No fim, o Mapa consolida tudo num documento que ela imprime ou salva.

### Gerar as skills a partir do material

Em `/admin/skills`, módulo por módulo, o sistema lê o material que a mentora subiu e extrai
de dois a cinco procedimentos, escritos como instruções que alguém conseguiria seguir. Ela
lê, ajusta e marca como revisada.

Essas skills saem de um modelo que não sabe para onde elas vão — isso é deliberado, para
não enviesar a extração. Há uma revisão pendente registrada em `docs/REVISAR-SKILLS.md`.

---

## Provedores de inteligência artificial

Quatro, escolhidos na etapa 2 e trocáveis depois. A chave fica no `.env` do servidor,
nunca na tela.

| Provedor | Variável no `.env` | Modelo padrão |
|---|---|---|
| Claude (Anthropic) | `CLAUDE_API_KEY` | `claude-sonnet-5-5` |
| ChatGPT (OpenAI) | `OPENAI_API_KEY` | `gpt-5.6-terra` |
| Gemini (Google) | `GEMINI_API_KEY` | `gemini-3.8-flash` |
| Meta AI (Llama) | `META_API_KEY` | `llama-maverick` |

**Sobre a Meta:** os modelos Llama costumam ser alcançados por um intermediário
compatível com o formato da OpenAI (Groq, Together, Bedrock), não por uma API própria da
Meta nos mesmos moldes das outras três. O endereço base é configurável por isso. Confirmar
antes de prometer esse provedor para a cliente.

### Modo de simulação

Com `LLM_MODE=stub` no `.env`, o fluxo inteiro roda com respostas de arquivo, sem chamar
API e sem gastar. É o padrão do `.env.example` e é o que os testes usam.

### Quanto custa

Um diagnóstico completo (seis módulos mais o Mapa, contando uma regeração) gasta mais ou
menos 78 mil tokens de entrada e 16 mil de saída. Preços conferidos nas páginas oficiais
em 2026-10-09:

| Modelo | Por diagnóstico |
|---|---|
| Claude Haiku 5.5 | ~US$ 0,02 |
| GPT-5.6 Luna | ~US$ 0,04 |
| Gemini 3.5 Flash-Lite | ~US$ 0,06 |
| Gemini 3.8 Flash | ~US$ 0,12 |
| Claude Sonnet 5.5 | ~US$ 0,32 |
| GPT-5.6 Terra | ~US$ 0,35 |
| Claude Opus 5.5 | ~US$ 0,63 |

O custo de IA não move a precificação da mentoria. O custo que pesa é o servidor.

---

## Duas regras que o código não deixa quebrar

Estão em `src/verificador.ts`, com **políticas opostas de propósito**:

**Glossário.** Quatro palavras não aparecem em saída de IA nem em texto da interface:
"vendas" (use crescimento ou atendimento), "comercial" (use posicionamento), "plano de
saúde" (use serviços de saúde), "mentoria em grupo" (use acompanhamento). Encontrou,
tenta de novo uma vez; insistiu, **mostra assim mesmo e registra** — esconder seria pior
que mostrar um texto que ela pode editar.

**Conteúdo clínico.** A inteligência artificial nunca sugere procedimento, conduta,
protocolo clínico ou diagnóstico de saúde. Encontrou, tenta de novo uma vez; insistiu,
**bloqueia, não exibe e avisa a mentora.** Detecção de classe aberta nunca é completa,
então a garantia vem da política de bloqueio, não de a lista de padrões estar certa.

Não junte as duas numa função com uma política só.

---

## Requisitos de máquina

| | Mínimo | Recomendado |
|---|---|---|
| RAM | 4 GB | 8 GB |
| Disco | 20 GB | 50 GB |
| Portas | 3000 | 80 e 443 atrás de proxy |

A KVM 1 da Hostinger (4 GB) roda o que existe hoje. Quando entrar a geração do PDF do
Mapa, que usa um Chromium invisível, 4 GB fica apertado dividindo com o Postgres — aí é
KVM 2. Os limites de memória no `docker-compose.yml` já estão ajustados para 4 GB.

---

## Operação

```bash
docker compose logs -f app        # acompanhar
docker compose ps                 # o que está de pé
docker compose restart app        # reiniciar só a aplicação
docker compose down               # parar tudo, sem perder dados
docker compose pull && docker compose up -d --build   # atualizar
```

`GET /healthz` responde o estado de cada dependência separado: banco, inteligência
artificial e acervo. Devolve 503 quando banco ou IA estão fora.

Os dados vivem em volumes do Docker (`dados_banco` e `dados_acervo`) e sobrevivem a
`down` e a troca de imagem. Para fazer cópia de segurança do banco:

```bash
docker compose exec banco pg_dump -U hub hub > copia-$(date +%F).sql
```

---

## Desenvolvimento

Node 22 ou mais novo, que lê TypeScript direto, sem passo de compilação.

```bash
npm install
export DATABASE_URL="postgres://hub@localhost:5432/hub"
export LLM_MODE=stub
npm run dev
```

### Como está organizado

```
src/
  server.ts          partida, rotas de raiz, entrar/sair, /healthz
  db.ts              pool do Postgres, helpers, config chave/valor
  migrar.ts          migrações em SQL, rodadas na partida
  auth.ts            senha com scrypt, sessões por token com hash
  verificador.ts     glossário e barreira clínica
  ia/index.ts        os quatro provedores atrás de uma interface só
  rotas/setup.ts     o assistente de nove etapas
  visao/layout.ts    HTML e CSS
db/migrations/       001 schema, 002 conteúdo de fábrica
docs/                specs, decisões pendentes e o protótipo visual
```

### Duas camadas de conteúdo

Prompts e perguntas são conteúdo editável, não constantes no código. Cada prompt tem
`texto_fabrica` (vem na imagem) e `texto_mentora` (a edição dela, guardada no banco).
Atualizar o programa troca a fábrica e **nunca** encosta na camada dela.

### Regra de migração

Aditiva **e** com valor padrão ou aceitando nulo. Coluna nova `NOT NULL` sem padrão é
aditiva e mesmo assim quebra a imagem anterior durante um rollback.

---

## Documentos

Em `docs/`: a especificação do Hub com as três revisões aplicadas, a especificação do
Second Brain, as decisões ainda em aberto, e o protótipo visual da constelação.

O Hub não depende do Second Brain para funcionar. Ele tem banco próprio e a integração
entra depois, como apoio.
