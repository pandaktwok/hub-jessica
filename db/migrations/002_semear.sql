-- Conteúdo de fábrica. Tudo aqui é substituível pela Jessica no assistente.

INSERT INTO setup_etapas (numero, slug, titulo, obrigatoria) VALUES
  (1, 'conta',        'Sua conta',                      true),
  (2, 'ia',           'Conectar a inteligência artificial', true),
  (3, 'armazenamento','Onde guardar os arquivos',       true),
  (4, 'skills',       'Suas skills',                    false),
  (5, 'categorias',   'Categorias do acervo',           true),
  (6, 'perfil',       'Seu perfil de mentora',          true),
  (7, 'modulos',      'Os seis módulos e o seu material', true),
  (8, 'consentimento','Os textos de consentimento',     true),
  (9, 'precificacao', 'Custos e preço da sua mentoria', false)
ON CONFLICT (numero) DO NOTHING;

INSERT INTO categorias (slug, nome, cor, fixa) VALUES
  ('mentoria',         'Mentoria',          '#E8C978', true),
  ('mentoria-pessoal', 'Mentoria pessoal',  '#7FB2C9', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO prompts (slug, titulo, texto_fabrica) VALUES
('_sistema', 'Diretrizes gerais', 'Você é a assistente de diagnóstico de posicionamento de {{MENTORA}}.

REGRAS QUE NÃO SE QUEBRAM:
1. Nunca sugira procedimento, conduta, protocolo clínico ou diagnóstico de saúde. Se a
   mentorada pedir opinião técnica sobre um procedimento, diga que isso está fora do que
   você faz e volte ao posicionamento do trabalho dela.
2. Vocabulário proibido, sem exceção: "vendas" (use crescimento ou atendimento),
   "comercial" (use posicionamento), "plano de saúde" (use serviços de saúde),
   "mentoria em grupo" (use acompanhamento).
3. Responda inteiro o que foi perguntado. Não segure conteúdo para criar curiosidade.
   Quando o assunto passar do escopo do módulo, diga qual assunto ficou de fora,
   nomeando o assunto, nunca oferecendo nada em troca.
4. Ancore tudo em respostas literais da mentorada. Cite as palavras dela.
5. Sem frase de efeito, sem elogio sem conteúdo, sem promessa de resultado financeiro.
6. Não abra com "com base nas suas respostas" nem equivalente. Comece pelo conteúdo.
7. Não feche com incentivo motivacional. Termine no último ponto útil.

Escreva em português do Brasil, tratando a mentorada por você.'),

('modulo-1', 'Módulo 1 — Persona', 'A partir das respostas abaixo, monte o cartão de persona da cliente ideal dela.

Devolva JSON com: nome_ficticio, dor_principal, desejo, frase_posicionamento, vocabulario
(lista de termos que essa cliente usa de verdade).

O nome fictício abre o texto. Nada de preâmbulo.'),

('modulo-2', 'Módulo 2 — Diferenciais', 'Identifique os diferenciais reais do trabalho dela, separando o que é diferencial
de verdade do que toda colega também faz.

Use a persona do módulo 1. Devolva JSON com: diferenciais (lista com nome e por_que_importa),
o_que_e_commodity (lista), prova (o que ela já tem que comprova cada diferencial).'),

('modulo-3', 'Módulo 3 — Mensagem', 'Escreva a mensagem central do posicionamento dela, ligando a persona do módulo 1 aos
diferenciais do módulo 2.

Devolva JSON com: mensagem_central, tres_variacoes (lista), o_que_evitar_dizer (lista).'),

('modulo-4', 'Módulo 4 — Precificação', 'Analise a precificação do serviço dela com base no valor entregue, não no tempo gasto.

O valor-hora e os números são calculados pelo programa e entregues a você prontos; você
escreve o raciocínio em volta deles, nunca a aritmética.

Devolva JSON com: raciocinio, o_que_justifica_o_aumento (lista), riscos_da_mudanca (lista).
Não cite faixa de mercado: você não tem essa informação.'),

('modulo-5', 'Módulo 5 — Protocolos e ofertas', 'Monte de dois a três formatos de pacote a partir dos diferenciais do módulo 2 e da
precificação do módulo 4.

Devolva JSON com: pacotes (lista com nome, para_quem, o_que_inclui, faixa_de_preco,
por_que_funciona).'),

('modulo-6', 'Módulo 6 — Plano de ação', 'Monte o plano dos próximos passos dela, concreto e na ordem de execução.

Devolva JSON com: proximos_3_passos (lista com passo, prazo, como_saber_que_deu_certo),
plano_90_dias (lista).'),

('mapa', 'Mapa de Diagnóstico', 'Consolide os seis módulos em um documento único para a mentorada ler e mostrar.

Devolva JSON com: resumo_executivo (um parágrafo), proximos_3_passos (lista), e secoes
(lista com titulo e corpo, uma por módulo, na ordem).

O resumo executivo precisa ser específico desta mentorada: alguém que leia dois mapas
diferentes tem que saber qual é de quem.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO perguntas (modulo, campo, rotulo, ajuda, exemplo, tipo, ordem) VALUES
(1,'cliente_recente','Descreva uma cliente que você atendeu recentemente e que você gostaria de atender mais vezes','Uma pessoa real, não um tipo ideal.','Mulher de 38 anos, veio por indicação, já tinha passado por duas colegas antes e chegou desconfiada.','texto_longo',1),
(1,'o_que_ela_queria','O que ela queria quando procurou você?',NULL,'Ela dizia que queria resolver uma queixa específica, mas o que ela queria mesmo era parar de se sentir empurrada de consulta em consulta.','texto_longo',2),
(1,'o_que_ela_temia','O que ela temia?',NULL,'Gastar de novo e não resolver.','texto_longo',3),
(1,'palavras_dela','Que palavras ela usou? Escreva do jeito que ela falou','Palavra dela, não termo técnico.','"Eu só queria alguém que me escutasse até o fim."','texto_longo',4),
(1,'como_chegou','Como ela chegou até você?',NULL,'Indicação de outra paciente.','texto_curto',5),
(1,'o_que_mudou','O que mudou na vida dela depois do atendimento?',NULL,'Voltou a treinar, e trouxe a irmã.','texto_longo',6),
(1,'quem_nao_atender','Que tipo de cliente você prefere não atender?',NULL,'Quem quer resultado imediato e não quer acompanhar o processo.','texto_longo',7),

(2,'o_que_faz_diferente','O que você faz de diferente das colegas da sua área?',NULL,'Faço um retorno de 40 minutos que ninguém cobra à parte.','texto_longo',1),
(2,'o_que_ouve','O que as suas clientes dizem que você faz melhor?',NULL,'Que eu explico de um jeito que dá para entender.','texto_longo',2),
(2,'formacao','Que formação, experiência ou vivência sustenta isso?',NULL,'Doze anos de pronto-socorro antes de abrir o consultório.','texto_longo',3),
(2,'o_que_todas_fazem','O que toda colega da sua área também oferece?','Serve para separar o que é diferencial do que é básico.','Consulta, retorno, pedido de exame.','texto_longo',4),
(2,'prova','Que prova você tem do que acabou de dizer?',NULL,'Trinta e poucos depoimentos em vídeo e uma taxa de retorno alta.','texto_longo',5),

(3,'como_se_apresenta','Como você se apresenta hoje quando alguém pergunta o que você faz?',NULL,'Digo o nome da especialidade e paro aí.','texto_longo',1),
(3,'o_que_incomoda','O que te incomoda na forma como a sua área costuma se comunicar?',NULL,'Promessa de resultado e foto de antes e depois.','texto_longo',2),
(3,'o_que_nao_dizer','O que você nunca diria sobre o seu trabalho?',NULL,'Que é garantido.','texto_longo',3),

(4,'cobra_hoje','Quanto você cobra hoje pelo seu principal serviço?',NULL,'450 por consulta.','numero',1),
(4,'horas_por_atendimento','Quantas horas esse serviço consome, contando preparo e retorno?',NULL,'2,5','numero',2),
(4,'atendimentos_por_mes','Quantos atendimentos desse tipo você faz por mês?',NULL,'40','numero',3),
(4,'custo_fixo_mes','Qual é o seu custo fixo mensal de consultório?',NULL,'12000','numero',4),
(4,'o_que_trava','O que te trava na hora de aumentar o preço?',NULL,'Medo de perder as pacientes antigas.','texto_longo',5),

(5,'formatos_hoje','Que formatos de atendimento você oferece hoje?',NULL,'Só consulta avulsa.','texto_longo',1),
(5,'o_que_pedem','O que as clientes pedem que você ainda não oferece?',NULL,'Acompanhamento mais longo, com mais contato entre consultas.','texto_longo',2),
(5,'quanto_tempo','Quanto tempo leva para a cliente ver resultado no seu trabalho?',NULL,'Uns três meses.','texto_curto',3),

(6,'proximo_passo','Qual é a primeira coisa que você faria amanhã se nada te impedisse?',NULL,'Refazer o Instagram inteiro.','texto_longo',1),
(6,'o_que_impede','O que te impede hoje?',NULL,'Tempo e não saber por onde começar.','texto_longo',2),
(6,'prazo','Em quanto tempo você quer ver isso de pé?',NULL,'Seis meses.','texto_curto',3)
ON CONFLICT (modulo, campo) DO NOTHING;
