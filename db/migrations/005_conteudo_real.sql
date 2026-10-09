-- Perguntas e prompts tirados da Especificação Funcional escrita pela Jessica.
-- A versão anterior usava perguntas inventadas e errava o nome dos módulos 3 e 6.
--
-- Módulo 3 é "Nome do Método", não "Mensagem".
-- Módulo 6 é "Posicionamento em Redes Sociais", não "Plano de ação".

DELETE FROM respostas WHERE campo NOT IN (SELECT campo FROM perguntas);
DELETE FROM perguntas;

INSERT INTO perguntas (modulo, campo, rotulo, ajuda, exemplo, tipo, ordem, obrigatoria) VALUES
-- Módulo 1 · Diagnóstico de Cliente Ideal (Persona) — base: StoryBrand
(1,'dois_melhores','Descreva dois dos melhores clientes que você já atendeu','Sem nome real. Idade aproximada, rotina, o que fazia, por que te procurou.','Mulher de 38 anos, dois filhos pequenos, trabalha fora o dia todo. Procurou depois de dois anos adiando.','texto_longo',1,true),
(1,'queixa_comum','Qual é a queixa, medo ou frustração mais comum que esse tipo de cliente traz antes de te procurar?',NULL,'Medo de gastar de novo e não resolver, como nas vezes anteriores.','texto_longo',2,true),
(1,'desejo_real','O que ele realmente deseja alcançar, além do resultado técnico em si?','O resultado emocional, prático, de identidade.','Voltar a se reconhecer no espelho e parar de evitar foto.','texto_longo',3,true),
(1,'o_que_impede','O que geralmente o impede de buscar ajuda antes?','Crenças, tentativas anteriores frustradas, medo, vergonha, preço.','Já tentou com duas colegas e saiu sem resposta; acha que vai ser igual.','texto_longo',4,true),
(1,'transformacao','Que transformação você percebeu nesse cliente depois de ser atendido por você?','Como ele estava antes e como ficou depois.','Chegou calada e desconfiada; três meses depois trouxe a irmã e indicou duas amigas.','texto_longo',5,true),
(1,'onde_esta','Onde esse cliente ideal costuma estar?','Bairro, cidade, redes sociais, grupos, tipo de indicação.','Instagram, grupos de mães do bairro, indicação de paciente antiga.','texto_longo',6,true),
(1,'palavras_dele','Escreva, com as palavras exatas que o próprio cliente usaria, como ele descreveria o problema dele','Palavra dele, não termo técnico. Isto vira o vocabulário que você usa em bio, post e conversa.','"Eu só queria alguém que me escutasse até o fim antes de pedir mais um exame."','texto_longo',7,true),

-- Módulo 2 · Mapa de Forças e Ativos
(2,'formacao','Formação acadêmica e especializações, com o ano de conclusão de cada uma',NULL,'Graduação 2010, residência 2013, especialização 2017.','texto_longo',1,true),
(2,'anos_atuacao','Há quantos anos você atua nessa área?',NULL,'12','numero',2,true),
(2,'dominio','Quais serviços ou procedimentos você domina com mais confiança e prefere entregar?',NULL,'Primeira consulta longa e acompanhamento de caso crônico.','texto_longo',3,true),
(2,'elogio_espontaneo','Que elogio ou feedback os clientes fazem espontaneamente sobre o seu atendimento, com mais frequência?',NULL,'Que eu explico de um jeito que dá para entender e não tenho pressa.','texto_longo',4,true),
(2,'faz_diferente','O que você acredita que faz diferente da maioria dos profissionais da sua área?',NULL,'Faço um retorno longo que ninguém cobra à parte.','texto_longo',5,true),
(2,'conquistas','Alguma conquista, prêmio, publicação, curso ou reconhecimento relevante?',NULL,'Capítulo de livro em 2021 e professora convidada numa pós.','texto_longo',6,false),

-- Módulo 3 · Nome do Método
(3,'passos_atendimento','Descreva, em poucas frases, os passos que você segue com um cliente do início ao fim do atendimento','Mesmo que hoje isso não tenha nome nem esteja formalizado.','Escuto a história inteira antes de examinar, depois explico o que vi, depois montamos o plano junto e marco o retorno.','texto_longo',1,true),
(3,'principio_guia','Existe algum princípio ou crença que guia o seu jeito de atender, diferente do padrão da sua área?',NULL,'Ninguém sai da minha sala sem entender o que tem.','texto_longo',2,true),
(3,'sensacao','Que sensação você quer que o cliente sinta ao lembrar do seu atendimento?','Por exemplo: leveza, precisão, cuidado, confiança, transformação.','Que foi levada a sério.','texto_longo',3,true),

-- Módulo 4 · Precificação Sugerida — base: precificação por valor
(4,'atend_semana','Quantos atendimentos ou consultas você realiza, em média, numa semana típica?',NULL,'18','numero',1,true),
(4,'valor_medio','Qual é o valor médio que você cobra hoje por atendimento?','Se tiver serviços com valores diferentes, informe o principal.','450','numero',2,true),
(4,'horas_dia','Quantas horas por dia, em média, você dedica a atendimentos?','Sem contar gestão e administrativo.','6','numero',3,true),
(4,'media_mercado','Você tem noção de quanto cobram profissionais parecidos com você, na sua região?','Informe o valor que você conhece e se você se sente abaixo, na média ou acima dele.','Acho que cobram entre 500 e 700. Me sinto abaixo.','texto_longo',4,true),
(4,'custo_fixo','Custos fixos mensais do consultório','Opcional. Serve para calcular o ponto de equilíbrio.','12000','numero',5,false),

-- Módulo 5 · Protocolos e Ofertas Sugeridas
(5,'servicos_hoje','Quais serviços ou procedimentos você já oferece separadamente hoje?',NULL,'Consulta avulsa e retorno.','texto_longo',1,true),
(5,'exige_retorno','Existe algum problema ou objetivo do cliente que normalmente exige mais de uma sessão ou retorno?',NULL,'Praticamente todo caso crônico precisa de três a quatro encontros.','texto_longo',2,true),
(5,'ja_empacotou','Você já tentou empacotar serviços em programas ou protocolos antes? O que funcionou e o que não funcionou?',NULL,'Tentei um pacote de três consultas; ninguém comprou porque eu não soube explicar.','texto_longo',3,true),

-- Módulo 6 · Posicionamento em Redes Sociais
(6,'bio_hoje','Como está hoje a sua bio e os destaques do Instagram?','Pode copiar e colar a bio como ela está.','"Médica · CRM 00000 · Agende sua consulta". Destaques: Antes e depois, Localização.','texto_longo',1,true),
(6,'tipo_conteudo','Que tipo de conteúdo você mais posta hoje?','Bastidor, educativo, depoimento, promocional, outro.','Quase só depoimento e divulgação de horário.','texto_longo',2,true),
(6,'frequencia_video','Com que frequência você aparece em vídeo ou stories, hoje?',NULL,'Umas duas vezes por mês, quando crio coragem.','texto_curto',3,true),
(6,'o_que_trava','O que mais te trava para aparecer mais?','Tempo, vergonha, falta de ideia, insegurança, outro.','Vergonha e falta de ideia do que falar.','texto_longo',4,true);

-- ------------------------------------------------------------------ prompts

UPDATE prompts SET titulo = 'Módulo 1 — Diagnóstico de Cliente Ideal', texto_fabrica =
'Monte o Perfil de Cliente Ideal a partir das respostas dela, usando a estrutura de herói
e guia: o CLIENTE é o herói, a profissional é a guia. Nunca o contrário.

Devolva JSON com:
- nome_ficticio
- resumo: duas a três linhas sobre quem é essa pessoa
- dor_central
- desejo_central
- objecao_mais_comum
- onde_esta
- frase_posicionamento: no formato "Eu ajudo [cliente ideal] que sofre com [dor] a alcançar [transformação]"
- vocabulario: de 8 a 12 expressões LITERAIS tiradas das respostas dela, para reaproveitar
  em bio, post e conversa. Não invente expressão: só o que ela escreveu.

Comece pelo nome fictício. Sem preâmbulo.' WHERE slug = 'modulo-1';

UPDATE prompts SET titulo = 'Módulo 2 — Mapa de Forças e Ativos', texto_fabrica =
'Levante o que ela já tem de diferencial, inclusive o que ela ainda não sabe nomear.

Sintetize padrões cruzando formação, tempo de experiência e os elogios que ela recebe.
Não repita o que ela digitou: encontre o que está por trás.

Devolva JSON com:
- diferenciais: de 3 a 5, cada um com nome, por_que_importa e como_comunicar (de forma
  consultiva, sem soar arrogante nem genérico)
- frase_de_apresentacao: pronta para bio
- lacunas: o que falta para sustentar esses diferenciais. Por exemplo, se ela tem
  experiência mas nenhum depoimento documentado, isso é lacuna e vira próximo passo.' WHERE slug = 'modulo-2';

UPDATE prompts SET titulo = 'Módulo 3 — Nome do Método', texto_fabrica =
'Transforme o jeito de atender dela, hoje sem nome, em um método com identidade própria.

Devolva JSON com:
- nomes: de 5 a 10 opções, cada uma com nome e por_que (uma linha ligando o nome às
  respostas dela). Nomes curtos, fáceis de lembrar, evocativos. Evite termo genérico de
  mercado e evite nome que pareça curso raso.
- etapas: de 3 a 5 etapas nomeadas, construídas a partir da descrição que ELA deu do
  próprio atendimento. Por exemplo: 1. Escuta, 2. Diagnóstico, 3. Plano, 4. Acompanhamento.

A escolha final do nome é dela. Você sugere, ela decide.' WHERE slug = 'modulo-3';

UPDATE prompts SET titulo = 'Módulo 4 — Precificação Sugerida', texto_fabrica =
'Dê um norte de quanto cobrar, com base no valor entregue, não no tempo gasto.

Os números já vêm calculados pelo programa. Use exatamente eles e não refaça conta nenhuma.

Cruze o valor-hora com o módulo 1 (poder aquisitivo e perfil do cliente ideal) e com o
módulo 2 (força dos diferenciais): quanto mais forte o diferencial e mais alto o poder
aquisitivo do cliente ideal, maior a margem sugerida acima da média de mercado que ELA
informou.

Devolva JSON com:
- faixa_entrada: valor e para_que (captar cliente novo, gerar prova social)
- faixa_padrao: valor e para_que (o valor-âncora do método)
- faixa_premium: valor e para_que (protocolo ou pacote, ligado ao módulo 5)
- raciocinio: o texto explicando o porquê de cada faixa. Nunca entregue número sem isto.
- aviso: que é sugestão de referência, a ser revisada com a mentora e ajustada a cada trimestre.

A média de mercado é a que ela informou. Você não tem outra fonte e não deve inventar uma.' WHERE slug = 'modulo-4';

UPDATE prompts SET titulo = 'Módulo 5 — Protocolos e Ofertas Sugeridas', texto_fabrica =
'Ajude a transformar serviços avulsos em pacotes com nome e estrutura.

Devolva JSON com:
- protocolos: de 2 a 3, cada um com nome, numero_de_sessoes, para_quem (o tipo de cliente
  do módulo 1) e faixa_de_preco (ligada às faixas do módulo 4)

Você sugere APENAS a estrutura comercial: nome, formato, número de sessões, para quem.
O conteúdo técnico e clínico de cada protocolo é definido e validado pela própria
profissional. Não descreva procedimento, conduta nem técnica.' WHERE slug = 'modulo-5';

UPDATE prompts SET titulo = 'Módulo 6 — Posicionamento em Redes Sociais', texto_fabrica =
'Traduza a persona e o método em bio, destaques e linha editorial.

Devolva JSON com:
- bio_sugerida: headline de identidade mais subheadline de transformação, no formato
  "Ajudando [persona do módulo 1] a [transformação], sem [objeção comum]"
- destaques: de 3 a 5, coerentes com a jornada do cliente ideal
- pilares: de 3 a 4 pilares de conteúdo, cada um com nome e de 2 a 3 ideias_de_post
  específicas, usando o vocabulário literal levantado no módulo 1
- constancia: frequência recomendada, frequência atual que ela informou, e uma
  recomendação prática de ajuste' WHERE slug = 'modulo-6';

UPDATE prompts SET texto_fabrica =
'Consolide os seis módulos num documento único para a mentorada ler, guardar e mostrar.

Devolva JSON com:
- resumo_executivo: um parágrafo
- proximos_3_passos: lista, cada um com passo, prazo e como_saber_que_deu_certo
- secoes: uma por módulo, na ordem, cada uma com titulo e corpo

O resumo executivo precisa ser específico desta mentorada: quem ler dois mapas diferentes
tem que saber na hora qual é de quem.' WHERE slug = 'mapa';
