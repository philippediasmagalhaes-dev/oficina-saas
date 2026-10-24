# Consulta de placa com FipePlaca

## Intenção

Preencher o cadastro de veículos da oficina a partir da placa com custo previsível e baixo, mantendo o preenchimento manual disponível em qualquer falha.

## Provedor escolhido

FipePlaca, rota `GET /placa/{placa}`. A documentação pública informa preço pré-pago de R$ 0,08 por consulta bem-sucedida, sem cobrança para placa inexistente, parâmetro inválido ou indisponibilidade. A integração não chamará `/fipe`, pois essa seria uma segunda cobrança e o piloto precisa somente dos dados cadastrais do veículo.

Referência: https://www.fipeplaca.com.br/api-docs

## Abordagens consideradas

1. Manter apenas o adaptador genérico atual: exige mais configuração e não entende saldo nem os códigos de erro do FipePlaca.
2. Integrar diretamente sem proteção de custo: simples, mas permite cobranças repetidas por cliques e consultas recentes.
3. Adaptador FipePlaca sobre a estrutura existente: escolhido. Mantém troca futura de provedor, usa cache, evita repetição e apresenta falhas seguras.

## Comportamento

- Normalizar placas antigas e Mercosul antes da chamada.
- Usar `Authorization: Bearer` somente no servidor.
- Preencher marca, modelo, anos, cor, combustível, município, UF, cilindrada, potência e chassi mascarado.
- Nunca solicitar ou armazenar Renavam, proprietário ou dados pessoais do veículo.
- Reaproveitar consulta salva da mesma oficina por 30 dias, sem nova cobrança.
- Desabilitar nova consulta no formulário depois de um resultado, até a placa ser alterada.
- Informar se houve consulta paga ou reaproveitamento do cache.
- Mostrar mensagens distintas para placa inexistente, saldo insuficiente, chave inválida e indisponibilidade, sem revelar detalhes do provedor ou segredo.
- Não repetir automaticamente uma chamada, evitando risco de cobrança duplicada.

## Configuração

- `PLATE_LOOKUP_PROVIDER=fipeplaca`
- `PLATE_LOOKUP_API_TOKEN=<chave fp_live_...>`
- `PLATE_LOOKUP_API_URL` fica opcional; quando ausente, usar `https://api.fipeplaca.com.br/gateway/v1/placa/{plate}`.

## Fora do escopo

- Valor FIPE e histórico de preços.
- Restrições, débitos, Renavam ou dados do proprietário.
- Recarga automática de saldo.

