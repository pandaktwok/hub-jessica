# Decisões pendentes — Hub de Diagnóstico + Second Brain

Doze pontos. Cada um é independente dos outros: você pode responder na ordem que
quiser, pular e voltar. Em quase todos basta uma letra; em alguns, uma palavra ou um
número.

Onde está escrito **Minha recomendação**, é o que eu faria e por quê. Discordar é
esperado, por isso está separado das opções.

Versão deste arquivo: 2026-10-09.

---

## BLOCO 1 — Decidir antes de escrever a primeira linha de código

---

### 1. Calibrar os seis prompts à mão, antes de tudo

**O que é.** Antes de construir qualquer tela, você pega os seis módulos do PDF da
Jessica e roda eles na mão, numa janela de conversa com a IA, usando as respostas de
três mentoradas reais. Lê a saída. Ajusta o texto do prompt. Repete até a saída ficar
boa. Esses prompts calibrados viram o conteúdo que o programa vai usar.

**Por que importa.** A aposta mais arriscada do projeto inteiro é que um diagnóstico de
posicionamento escrito por IA saia específico o bastante para uma médica pagar por ele.
Se sair genérico, não tem tela, banco nem fila que salve. Testar isso à mão custa de
três a cinco dias e zero de programação. Descobrir depois custa dois meses.

**Opções**

- **A)** Fazer a calibragem primeiro. Nada de código antes de a saída estar aprovada
  pela Jessica.
- **B)** Construir o encanamento em paralelo e calibrar os prompts no meio do caminho.
- **C)** Construir tudo e calibrar no fim, como estava no spec original.

**Minha recomendação: A.** É o único ponto do projeto onde você compra informação caríssima
por um preço baixo. E se der certo, os prompts calibrados já entram como o padrão do
programa, então o trabalho não se perde.

**Se escolher A, preciso saber:** quais três mentoradas, ou se a Jessica vai escolher.

**Sua resposta:**

```
Opção:
Quais 3 mentoradas:
```

---

### 2. O tamanho do projeto mudou: 24 dias viraram 69

**O que é.** O primeiro spec dizia 24 dias de trabalho. Depois das três revisões, a conta
real é: 37 dias no Hub, 3 a 5 dias de calibragem dos prompts, e 29 dias no Second Brain
(16,5 originais mais 12,5 que o assistente de primeiro acesso acrescentou). Total acima
de 69 dias de equipe humana.

**Por que importa.** Isso não é estouro de estimativa, é escopo que apareceu: instalação
que não existia, autenticação que não tinha tabela, o assistente de 9 etapas, LGPD de
verdade. Tudo isso é necessário para um produto que é vendido e instalado por quem
compra. Mas 69 dias é uma decisão de negócio, não de engenharia.

**Opções**

- **A)** Segue o escopo inteiro. Produto vendável de verdade no fim.
- **B)** Fase 1 só para a Jessica usar, sem assistente de instalação, sem Google Drive,
  sem varredura de arquivos, com você instalando na mão na VPS dela. Corta uns 20 dias.
  O produto fica vendável só na fase 2.
- **C)** Fase 1 só o Hub, sem Second Brain nenhum. O Hub já funciona sozinho (ele tem
  banco próprio). Corta os 29 dias do Second Brain para depois. Perde a constelação e o
  assistente de IA respondendo em cima do material dela.

**Minha recomendação: C para começar, A como destino.** O Hub sozinho já é um produto que
entrega o Mapa de Diagnóstico, que é o que a mentorada vê e pelo que ela paga. O Second
Brain é o que faz o conjunto virar o sistema que você desenhou, mas ele não precisa
existir para a primeira mentorada ter valor. Entre B e C, C corta mais e corta coisa que
não é visível para a cliente final.

**Sua resposta:**

```
Opção:
```

---

### 3. Quem vai executar

**O que é.** As estimativas estão em duas escalas: dias de equipe humana e horas de
execução assistida (eu ou outro agente escrevendo o código). Algumas coisas comprimem
muito (formulário, banco, API), outras quase nada (calibrar prompt, conferir contraste em
celular de verdade, cronometrar instalação).

**Por que importa.** Muda o cronograma e muda quem precisa revisar o quê. Você disse que
tem equipe e que trabalha mais na arquitetura e na direção.

**Opções**

- **A)** Execução assistida, você revisando. Os 69 dias viram algo entre 10 e 14 dias de
  trabalho seu de revisão, mais o que não comprime.
- **B)** Sua equipe executa, eu entrego spec e reviso o que voltar.
- **C)** Misto: eu faço o Hub, sua equipe faz o Second Brain, ou o contrário.

**Minha recomendação: A para o Hub.** Ele é fechado, bem especificado agora, e tem muita
coisa mecânica. O Second Brain tem mais decisão de arquitetura por metro quadrado e se
beneficia de alguém seu olhando junto.

**Sua resposta:**

```
Opção:
```

---

## BLOCO 2 — Nomes e textos que ficam gravados

---

### 4. O nome da categoria onde o Hub guarda os arquivos

**O que é.** Quando a mentorada aceita um módulo, o Hub manda aquele texto para o Second
Brain e ele é guardado numa categoria. O spec chama essa categoria de `consultoria`. Você
falou "mentoria" e "mentoria pessoal".

**Por que importa.** Esse nome fica gravado no token de acesso e nas regras de permissão
dos dois programas. O Hub só consegue ver essa categoria e recebe recusa em todas as
outras — é a trava de segurança principal do sistema. Trocar o nome depois mexe nos dois
programas ao mesmo tempo.

**Opções**

- **A)** `consultoria`
- **B)** `mentoria`
- **C)** Outro nome que você preferir.

**Minha recomendação: B, `mentoria`.** Se é a palavra que você usa falando, é a palavra
que a Jessica vai ver na tela de categorias e vai reconhecer. "Consultoria" fui eu que
escolhi sozinho e não tem motivo nenhum para ser melhor.

**Observação.** "Mentoria pessoal" eu entendi como sendo outra categoria, para o material
dela mesma, não do Hub. Se for isso, ela nasce junto na etapa 5 do assistente.

**Sua resposta:**

```
Opção:
Nome, se for C:
```

---

### 5. Qual IA o produto usa, e se a Jessica pode trocar

**O que é.** No assistente de primeiro acesso, a etapa 3 é "conectar a IA". A pergunta é
se o produto aceita qualquer provedor que ela conectar, ou se é fixo em um.

**Por que importa.** Duas consequências. Primeira: o texto de consentimento precisa dizer
o nome do provedor e o país, porque as respostas dela saem do servidor. Se o provedor é
fixo, o texto é fixo; se ela escolhe, o texto tem que se montar sozinho com o nome que ela
conectou. Segunda: cada provedor tem um jeito diferente de ser chamado, e suportar vários
é mais trabalho.

**Opções**

- **A)** Um provedor fixo, escolhido por você. Mais simples, texto de consentimento fixo,
  menos lugar para dar errado.
- **B)** Ela escolhe entre dois ou três provedores que você suporta. O consentimento se
  monta com o nome dela. Uns 2 dias a mais.
- **C)** Qualquer provedor, via configuração livre. Mais flexível e o que mais quebra na
  mão de quem não é técnico.

**Minha recomendação: A no v1, B depois.** O produto é vendido para médicas, não para
desenvolvedores. Uma escolha a menos no assistente é uma coisa a menos para dar errado na
instalação, e trocar o provedor depois é mudança de configuração, não de arquitetura.

**Se escolher A, preciso saber:** qual provedor.

**Sua resposta:**

```
Opção:
Provedor, se for A:
```

---

### 6. Por quanto tempo guardar os dados da mentorada

**O que é.** As respostas que ela escreve e os textos gerados ficam no banco. Precisa ter
um prazo depois do qual são apagados. Eu escrevi 24 meses no spec, chutando.

**Por que importa.** A LGPD pede que dado pessoal não fique guardado para sempre sem
motivo. E o PDF prevê revisitar o diagnóstico aos 3 e aos 6 meses, então o prazo tem que
ser pelo menos maior que isso com folga. O Mapa em PDF é dela e fica com ela
independentemente do prazo.

**Opções**

- **A)** 12 meses após a conclusão do diagnóstico.
- **B)** 24 meses. É o que está escrito hoje.
- **C)** 36 meses.
- **D)** Outro prazo.

**Minha recomendação: B, 24 meses.** Cobre o acompanhamento de 6 meses com folga grande,
permite ela voltar no ano seguinte e comparar, e não é tempo demais para justificar. Mas
isso é exatamente o tipo de coisa que o advogado pode querer mudar na meia hora dele.

**Sua resposta:**

```
Opção:
Prazo, se for D:
```

---

## BLOCO 3 — O que entra na primeira versão

---

### 7. Onde a Jessica guarda os arquivos dela

**O que é.** Na etapa 2 do assistente você listou três destinos possíveis: uma pasta no
computador dela, o Google Drive, ou o disco da VPS. O programa precisa saber ler e
escrever no destino escolhido.

**Por que importa.** Os três são trabalhos diferentes, não três opções numa lista. Pasta
local e disco de VPS são praticamente a mesma coisa para o programa. Google Drive é outra
história: muda a camada de arquivos inteira, porque não é um disco, é um serviço com
autenticação, limite de chamadas e espera de rede. Fazer os três no v1 é uns 2,5 dias a
mais do que fazer só os dois primeiros.

**Opções**

- **A)** Só pasta local e disco de VPS no v1. Google Drive depois.
- **B)** Os três no v1.
- **C)** Só Google Drive, porque é onde ela já trabalha.

**Minha recomendação: A.** Se ela vai rodar numa VPS que ela contrata, o disco da VPS é o
destino natural e o mais rápido. Google Drive é conveniência que vale muito, mas vale
muito mais depois que o resto estiver de pé, e não bloqueia nada.

**Sua resposta:**

```
Opção:
```

---

### 8. A varredura dos arquivos dela

**O que é.** A etapa 6 do assistente: o programa passa pelos arquivos dela, acha
repetidos, separa o que é pessoal do que é profissional, e marca o que é sensível para
ela decidir o que fazer. Você pediu isso na primeira conversa e pediu que fosse opcional.

**Por que importa.** São uns 3 dias e é a única parte do sistema que mexe nos arquivos
reais dela. É também a que mais ajuda no primeiro dia, porque o produto chega vazio e o
material dela já existe espalhado.

**Opções**

- **A)** No v1, opcional e podendo pular, como você descreveu.
- **B)** Fica para o v2. No v1 ela vai apontando as pastas na mão.
- **C)** No v1, mas só a parte de achar repetidos, sem separar pessoal de profissional e
  sem marcar sensível. Uns 2 dias menos.

**Minha recomendação: B.** É a etapa mais arriscada do assistente (mexer em arquivo de
alguém que não é técnica) e a única que pode ser feita depois sem prejuízo, porque ela
pode ir apontando as pastas aos poucos. Se o ponto 2 for a opção C, isso vem naturalmente
junto com o Second Brain mais tarde.

**Sua resposta:**

```
Opção:
```

---

### 9. A cor do formulário que a mentorada preenche

**O que é.** A Carta Celeste, que você escolheu, tem fundo azul-escuro. Ela foi aprovada
olhando a constelação, onde o escuro é o céu e os pontos brilham. O formulário da
mentorada é outra coisa: 25 a 40 minutos lendo e digitando, muitas vezes no celular,
entre atendimentos.

**Por que importa.** Texto claro sobre fundo escuro em sessão longa cansa a vista e
derruba a velocidade de leitura. O sintoma não aparece como reclamação, aparece como
mentorada abandonando no módulo 3. E você acabou de pedir o assistente de instalação em
pastel sobre fundo claro, que é a mesma lógica.

**Opções**

- **A)** Carta Celeste escura na abertura, nas transições e na capa do Mapa; fundo claro no
  corpo do formulário e no texto gerado. A marca aparece onde se olha, o claro fica onde
  se lê.
- **B)** Tudo na Carta Celeste escura, como a decisão original.
- **C)** Tudo claro, Carta Celeste só no Mapa exportado.

**Minha recomendação: A.** É reversível a qualquer momento, porque são cores, não
estrutura. E deixa o produto coerente com o assistente que você pediu em pastel.

**Sua resposta:**

```
Opção:
```

---

### 10. O preço sugerido no módulo 4

**O que é.** O módulo 4 é precificação. O spec original pedia uma tabela com "valor atual
x valor sugerido x faixa de mercado". Não existe fonte nenhuma para essa faixa de mercado
em lugar nenhum do projeto — eu inventei essa coluna sem perceber.

**Por que importa.** Sem fonte, a IA inventaria faixas de preço de serviços médicos no
Brasil e o produto apresentaria isso numa tabela para uma médica precificar o trabalho
dela em cima. Além de errado, encosta na regra do PDF que proíbe promessa de resultado
financeiro.

**Opções**

- **A)** Sai a coluna. Fica valor atual e valor sugerido, com o raciocínio em cima das
  respostas dela.
- **B)** A Jessica fornece uma base de referência dela, citada como dela, e a coluna volta.
- **C)** A coluna volta com fonte pública citada, se existir alguma confiável.

**Minha recomendação: A agora, B quando ela quiser.** Sem fonte não dá. Com fonte dela,
vira um diferencial, porque é a experiência dela e não um número de internet.

**Sua resposta:**

```
Opção:
```

---

## BLOCO 4 — Negócio

---

### 11. Vender a metodologia da Jessica para outras mentoras

**O que é.** O conteúdo deste produto é o método da Jessica: os seis módulos, as sete
diretrizes de tom, o glossário de palavras, a lógica de posicionamento. Está tudo no PDF
dela. O programa é o encanamento; o método é o valor.

**Por que importa.** Se você vender para outra médica que faz mentoria para médicas, você
está vendendo o método de posicionamento da Jessica para uma concorrente direta dela. O
software é seu, o método é dela. Isso precisa estar resolvido entre vocês dois antes de
existir a segunda cliente, não depois.

**Opções**

- **A)** Produto exclusivo da Jessica. Você vende o software para outros nichos com outro
  conteúdo, e o método dela não sai.
- **B)** Licenciamento: ela recebe um percentual de cada venda que usar o método dela.
- **C)** Marca branca: o produto vai vazio e cada mentora põe o método dela. O da Jessica
  fica como exemplo de como preencher, não como conteúdo que vai junto.
- **D)** Ainda não decidir, mas registrar que está em aberto.

**Minha recomendação: C como arquitetura, A ou B como combinado.** O programa já está sendo
construído para isso: a etapa 7 do assistente transforma nome, voz e diretrizes em
configuração em vez de código. Então tecnicamente dá para ir vazio. O que vai junto ou não
é combinado comercial entre vocês, e aí eu não tenho opinião que valha.

**Sua resposta:**

```
Opção:
```

---

### 12. Rodar mais duas revisões antes de construir

**O que é.** Duas coisas ficaram pendentes do processo. A primeira: o escopo passou de 24
para 69 dias e nenhuma revisão de produto olhou isso (a `/plan-ceo-review` existe para
exatamente esse tipo de decisão). A segunda: o spec do Second Brain está fechado e
revisado, mas as 12,5 diárias do assistente de primeiro acesso ainda não entraram nele.

**Por que importa.** Hoje o spec do Second Brain está mentindo sobre o próprio tamanho, e
seria eu escrevendo em cima de um documento já aprovado sem passar pelo mesmo crivo que ele
passou.

**Opções**

- **A)** As duas: revisão de produto sobre o escopo novo, e revisão do spec do Second
  Brain com as emendas do assistente.
- **B)** Só a do Second Brain. O escopo você decide no ponto 2 deste arquivo e pronto.
- **C)** Nenhuma. Segue para a construção com o que está escrito.

**Minha recomendação: B.** O ponto 2 deste arquivo já é a decisão de escopo, feita por você
e não por uma revisão. A do Second Brain é necessária porque é documento aprovado sendo
alterado. Se a sua resposta no ponto 2 for a opção C (só o Hub primeiro), a do Second
Brain pode esperar também.

**Sua resposta:**

```
Opção:
```

---

## Resumo para preencher rápido

| # | Decisão | Minha recomendação | Sua resposta |
|---|---------|-------------------|--------------|
| 1 | Calibrar prompts à mão primeiro | A | |
| 2 | Escopo de 69 dias | C agora, A como destino | |
| 3 | Quem executa | A para o Hub | |
| 4 | Nome da categoria | B (`mentoria`) | |
| 5 | Provedor de IA | A, fixo no v1 | |
| 6 | Retenção de dados | B (24 meses) | |
| 7 | Destino de armazenamento | A (local e VPS) | |
| 8 | Varredura de arquivos | B (v2) | |
| 9 | Cor do formulário | A (claro no corpo) | |
| 10 | Faixa de mercado no módulo 4 | A (sai) | |
| 11 | Metodologia da Jessica | C técnico, A ou B comercial | |
| 12 | Mais revisões | B | |

Se concordar com tudo, basta dizer "todas as recomendações" e eu sigo. Se discordar de
algumas, me diga só os números que mudam.
