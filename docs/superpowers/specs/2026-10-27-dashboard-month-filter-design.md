# Filtro mensal do dashboard

## Intenção

Permitir que o proprietário consulte o faturamento e a quantidade de serviços concluídos em qualquer mês, sem transformar o dashboard em uma segunda tela de relatórios.

## Abordagens consideradas

- Carregar todo o histórico e filtrar no navegador: simples, mas aumenta o consumo do Worker e repete o problema de limite de recursos.
- Reaproveitar os presets do Financeiro: oferece períodos maiores, porém não atende tão diretamente à comparação mês a mês.
- **Selecionada:** campo nativo de mês e consulta restrita no banco. É mais leve, mantém a URL compartilhável e segue o padrão já usado no relatório de colaboradores.

## Comportamento

- O dashboard aceita `?mes=AAAA-MM`; valor inválido volta ao mês atual.
- Um seletor “Mês do painel” aparece no cabeçalho com botão “Aplicar”.
- Faturamento e quantidade de serviços usam somente OS concluídas no intervalo UTC do mês selecionado.
- O card identifica o mês selecionado em vez de dizer apenas “no mês”.
- OS em andamento, recebimentos vencidos, prontos para entrega, prioridades, estoque e retenção continuam representando a operação atual.
- O banco recebe os limites do período, evitando carregar todo o histórico no Worker.

## Aceite

- Outubro de 2026 é o padrão em 27/10/2026.
- `?mes=2026-09` consulta de 01/09/2026 inclusive a 01/10/2026 exclusive.
- Mês inválido não causa erro.
- Testes, tipos, builds e smoke do Cloudflare passam.
