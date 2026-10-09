# hub-jessica — contexto para o Claude Code

Plataforma de diagnóstico de posicionamento para mentoria médica. Dono: Renan (pandaktwok).
Cliente final: Jessica Zock, médica que faz mentoria para outras médicas.

Tudo em português do Brasil: código, nomes de variável, mensagens, commits.

## Antes de mexer

Leia `docs/SPEC-hub-diagnostico-v1.md`. Ele passou por revisão de design, de DX, de
engenharia e por uma leitura externa independente, e as emendas estão aplicadas. O que
está escrito lá como decisão travada não se relitiga sem o Renan mandar.

`docs/DECISOES-PENDENTES.md` tem as decisões que ele já respondeu, com a justificativa
de cada uma.

## Regras que não se quebram

**O PDF da Jessica é a fonte.** O que estiver escrito nele sobre os seis módulos, o tom e
os limites vale mais que qualquer opinião de produto, minha ou de quem for.

**A IA nunca sugere conduta clínica.** Procedimento, protocolo, dosagem, diagnóstico de
saúde: nada disso sai para a mentorada. Em `src/verificador.ts` isso é política de
**bloqueio**, não de degradação. Não transforme em aviso.

**Quatro palavras não aparecem em lugar nenhum**, nem em saída de IA nem em texto fixo
da interface: "vendas" (use crescimento ou atendimento), "comercial" (use posicionamento),
"plano de saúde" (use serviços de saúde), "mentoria em grupo" (use acompanhamento).

**Glossário e verificação clínica têm políticas opostas de propósito.** Glossário que
insiste: mostra e registra. Clínico que insiste: bloqueia e avisa a mentora. Não unifique
as duas numa função só com uma política só — isso já foi um defeito e foi corrigido.

**Licença permissiva em toda dependência.** O produto vai ser vendido e roda em rede.
MIT, Apache 2.0, BSD. Copyleft de rede (AGPL) está fora.

**Nada de nome de mentora escrito no código.** Nome, marca e voz são configuração
(`config` chave `perfil`), com o material da Jessica como padrão de fábrica.

## Revisar as skills geradas — pendência do Renan

Quando o Renan reconectar este projeto, **revise as skills que o sistema gerou** a partir
do material que a Jessica subiu. Elas estão na tabela `skills` com `origem = 'gerada'` e
`revisada = false`, e foram escritas por um modelo que não sabia para onde iriam.

O que ele pediu, nas palavras dele:

> revise todas as skills para que estejam funcionando de conformidade com tudo que você já
> tem, você já usa e já está instalado, e que fique melhor do seu ponto de vista do Claude.
> E também para fazer alguma integração com outras skills que eu já tenha sobre o mesmo
> assunto, que eu possa ou não pôr no Claude.

Concretamente:

1. Leia as skills geradas e compare com o formato e a qualidade das skills que você já tem
   instaladas nesta sessão.
2. Reescreva o que estiver vago. Instrução que não muda o resultado de quem segue não é
   skill, é enfeite.
3. Procure sobreposição com skills que o Renan já tenha sobre posicionamento, diagnóstico
   de negócio ou escrita. Proponha juntar em vez de duplicar.
4. Marque `revisada = true` no que passar, e diga a ele o que mudou e por quê.
5. Pergunte a ele quais skills ele quer no Claude dele e quais ficam só dentro do produto.

Detalhes e histórico em `docs/REVISAR-SKILLS.md`.

## Como está organizado

```
src/
  server.ts            partida, login da mentora, /healthz, rotas de raiz
  db.ts                pool, helpers, config chave/valor
  migrar.ts            migrações SQL rodadas na partida
  auth.ts              scrypt para senha, sessões por token com hash
  verificador.ts       glossário e barreira clínica (políticas opostas)
  geracao.ts           motor: contexto acumulado com orçamento, chamada, verificação
  ia/index.ts          quatro provedores atrás de uma interface, mais modo stub
  rotas/setup.ts       assistente de nove etapas
  rotas/consultoria.ts o fluxo da mentorada: link, módulos, revisão, Mapa
  rotas/mentoradas.ts  painel: cadastro, link de acesso, ficha
  rotas/skills.ts      geração de skills a partir do material
  visao/layout.ts      HTML e CSS
```

## Decisões de implementação que têm motivo

**Prompts e perguntas são dados, não código.** Duas camadas: `texto_fabrica` vem na
imagem, `texto_mentora` é a edição dela no banco. Atualizar o programa troca a fábrica e
nunca encosta na camada dela. Mesma ideia para `perguntas`.

**`versao` em `geracoes` vem de uma sequence do banco**, não do código. Dois cliques em
"gerar de novo" corriam pelo mesmo número e um tomava violação de unicidade depois de já
ter pago a chamada.

**`geracoes` não é append-only.** Três colunas mudam no lugar. Por isso existe `edicoes`,
que é o histórico de verdade. Se você ler em algum lugar que `geracoes` é append-only,
é texto velho e está errado.

**Migração é aditiva E com padrão ou aceitando nulo.** Coluna nova `NOT NULL` sem padrão
é aditiva e mesmo assim quebra a imagem anterior num rollback.

**O Mapa tem tabela própria (`mapas`).** Guardá-lo em `geracoes` com `modulo = 6` colidia
com a geração do próprio módulo 6.

**Orçamento de contexto em `geracao.ts`.** Sem ele, no módulo 6 o prompt carrega cinco
módulos de saída mais todas as respostas, e a geração estoura os 30 segundos justamente
no módulo que a mentorada mais esperou. O corte é do material mais distante primeiro.

**A aritmética do módulo 4 é código, não modelo.** `numerosModulo4()` calcula e entrega
pronto; o modelo escreve o raciocínio em volta. Conta feita por modelo de linguagem não é
testável nem defensável.

**O enquadramento de rascunho vem antes do texto gerado na ordem do DOM**, não só
visualmente. Se o texto da IA aparece primeiro, ela lê como veredito e aceita sem revisar.

## Rodar

```bash
npm install
export DATABASE_URL="postgres://hub@localhost:5432/hub"
export LLM_MODE=stub      # fluxo inteiro sem chamar API
npm run dev
```

Com `LLM_MODE=stub` as respostas vêm de arquivo, determinísticas. Use isso para
desenvolver e testar; teste ponta a ponta que gasta API ninguém roda.

## O que ainda não existe

- Envio do link de acesso por e-mail (hoje a Jessica copia e manda)
- Export do Mapa em PDF com o Chromium invisível (hoje é a impressão do navegador)
- Trial de 15 dias e qualquer cobrança
- Integração com o Second Brain (o Hub funciona sem, por desenho)
- Revogação, retenção e exclusão pela própria mentorada (as colunas existem, as telas não)
