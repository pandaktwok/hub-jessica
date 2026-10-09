# Revisar as skills geradas

Pendência registrada em 2026-10-09, a pedido do Renan.

## O que aconteceu

O Hub gera skills a partir do material que a Jessica sobe em cada módulo da configuração
inicial. Quem escreve essas skills é a inteligência artificial que ela conectou — na
primeira rodada, o Gemini, com a chave que o Renan vai fornecer.

**O modelo gerador não recebe nenhum contexto sobre para onde as skills vão depois.** Isso
foi decisão do Renan e é deliberado: o prompt em `src/rotas/skills.ts` pede extração de
método a partir do material, e nada mais. Não diz que é para o Claude, não diz que é
produto, não diz quem vai ler. Contexto desse tipo enviesaria a extração sem melhorar o
resultado.

A consequência é que o que sai é matéria-prima honesta e não está no formato nem no nível
que uma skill boa precisa ter.

## O que fazer quando o Renan reconectar o projeto

As palavras dele:

> revise todas as skills para que estejam funcionando de conformidade com tudo que você já
> tem, você já usa e já está instalado, e que fique melhor do seu ponto de vista do Claude.
> E também para fazer alguma integração com outras skills que eu já tenha sobre o mesmo
> assunto, que eu possa ou não pôr no Claude.

### Onde elas estão

```sql
SELECT nome, modulo, descricao, quando_usar, instrucoes, gerada_por
  FROM skills WHERE origem = 'gerada' AND revisada = false
  ORDER BY modulo, nome;
```

### O passo a passo

1. **Leia todas antes de mexer em qualquer uma.** Skills geradas módulo a módulo repetem
   conceito entre si, porque o material da Jessica se sobrepõe entre módulos. Dá para ver
   isso lendo o conjunto, não uma de cada vez.

2. **Compare com o padrão das skills já instaladas na sessão.** Estrutura, nível de
   detalhe, quando a descrição dispara o uso. O que o Gemini escreveu provavelmente está
   mais prolixo e menos acionável que o padrão.

3. **Corte o que for enfeite.** O teste: a instrução muda o resultado de quem segue? "Seja
   empático com a mentorada" não muda nada. "Peça o exemplo de uma cliente real antes de
   deixar ela generalizar" muda. O segundo tipo fica, o primeiro sai.

4. **Preserve o vocabulário da Jessica.** Onde ela tem jeito próprio de nomear uma coisa,
   isso é o ativo do método dela e não deve ser traduzido para termo genérico.

5. **Procure sobreposição com o que o Renan já tem.** Ele mencionou ter skills sobre
   assuntos parecidos. Proponha juntar em vez de deixar duas versões convivendo.

6. **Marque e relate.** `UPDATE skills SET revisada = true` no que passar, e diga a ele o
   que mudou e por quê — não só que revisou.

7. **Pergunte o destino.** Quais ele quer no Claude dele, quais ficam só dentro do produto.
   Ele deixou isso em aberto de propósito.

## O que não fazer

Não reescreva as skills a partir do seu conhecimento geral sobre posicionamento de
negócio. O valor delas é serem o método da Jessica, extraído do material dela. Uma skill
bem escrita sobre posicionamento em geral vale menos aqui que uma skill tosca que captura
como ela realmente trabalha. Melhore a forma, não troque o conteúdo.

Não regere pelo painel para "começar limpo" sem avisar: `POST /admin/skills/gerar/:n`
apaga as skills geradas daquele módulo, e junto vão as edições manuais dela.
