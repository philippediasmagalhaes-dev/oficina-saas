# Data de entrada das OS legadas

## Intenção

Preservar a data real de entrada das ordens vindas do SHOficina e não transformar ausência de informação histórica em uma entrada no mês da importação.

## Comportamento aprovado

- OS com `ENTRADA` válida exibem essa data original.
- OS sem `ENTRADA` exibem `Data não informada`.
- A data técnica de criação do registro continua disponível para auditoria, mas não é apresentada como se fosse a entrada do veículo.
- OS novas continuam recebendo a data de entrada no momento da abertura.
- Datas de conclusão, entrega e atualização não são alteradas.

## Abordagens consideradas

1. Usar uma data sentinela antiga: descartada porque inventaria histórico.
2. Guardar a ausência apenas no metadado da importação: evitaria migração, mas espalharia regras do SHOficina pelas consultas do produto.
3. Criar `intake_at` anulável em `service_records`: escolhida porque representa corretamente o domínio, atende dados legados e serve também às OS futuras.

## Escopo

- Adicionar `intake_at` anulável e preencher registros existentes com `created_at` na migração.
- Na importação SHOficina, preencher `intake_at` apenas quando `ENTRADA` for válida.
- Reparar as 1.252 OS já importadas a partir do backup aprovado.
- Exibir a data de entrada nas listas, detalhes, impressão e histórico do veículo, com fallback textual para ausência.
- Não alterar valores, status, clientes, veículos, itens, pagamentos ou datas de conclusão.

