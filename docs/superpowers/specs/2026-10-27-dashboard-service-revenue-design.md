# Receita por serviço no Dashboard

## Intenção

Permitir que o dono da oficina veja, para o mês selecionado no Dashboard, quais serviços foram realizados e quais geraram mais receita de mão de obra.

## Escopo

- Adicionar um quadro “Receita por serviço” ao Dashboard.
- Respeitar o filtro mensal já existente.
- Agrupar serviços equivalentes pelo nome exibido no catálogo ou, nos registros antigos, pela descrição da OS.
- Mostrar ranking decrescente com quantidade, receita bruta de mão de obra e participação na receita de serviços do mês.
- Exibir até oito serviços e um estado vazio quando não houver dados.
- Não misturar peças/estoque no ranking; o faturamento total do mês continua no indicador principal.

## Abordagens consideradas

1. Agrupar as OS pela descrição principal. É simples, mas atribui peças e serviços diferentes ao mesmo texto e distorce o resultado.
2. Ler os itens de mão de obra das OS e usar a OS como compatibilidade para dados antigos. Escolhida porque representa o serviço realmente vendido sem perder o histórico importado.
3. Criar uma nova tabela analítica. Facilitaria relatórios futuros, mas adicionaria migração e duplicação de dados sem necessidade neste momento.

## Regras

- Apenas OS concluídas ou entregues, com `completedAt` dentro do intervalo mensal, entram no cálculo.
- Itens do tipo `service` usam `quantidade × preço unitário − desconto do item`.
- Uma OS sem item de serviço usa o catálogo/descrição e o valor histórico da OS como fallback.
- Nomes são normalizados para agrupar diferenças de maiúsculas, espaços e acentuação, preservando um nome legível na tela.
- A participação é calculada sobre a soma da receita de serviços exibida, não sobre peças.

## Fora do escopo

- Margem e custo por serviço.
- Comparação entre meses no mesmo gráfico.
- Exportação do ranking.

