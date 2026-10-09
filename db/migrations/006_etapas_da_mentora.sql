-- Conectar a IA e escolher onde guardar os arquivos passam a ser configuração técnica,
-- feita por quem instala, não pela mentora. O assistente dela fica só com o que é dela.

DELETE FROM setup_etapas;

INSERT INTO setup_etapas (numero, slug, titulo, obrigatoria) VALUES
  (1, 'conta',         'Sua conta',                        true),
  (2, 'perfil',        'Seu perfil de mentora',            true),
  (3, 'categorias',    'Categorias do seu acervo',         true),
  (4, 'modulos',       'Os seis módulos e o seu material', true),
  (5, 'skills',        'Gerar as suas skills',             false),
  (6, 'consentimento', 'Os textos de consentimento',       true),
  (7, 'precificacao',  'O preço da sua mentoria',          true);

-- Marca como concluída a conta, se já existir (instalação que já passou pelo assistente).
UPDATE setup_etapas SET concluida = true, concluida_em = now()
 WHERE slug = 'conta' AND EXISTS (SELECT 1 FROM mentora);
