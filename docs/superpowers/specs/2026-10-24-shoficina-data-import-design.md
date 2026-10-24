# Importação do legado SHOficina

## Objetivo

Importar o backup `SHBackup.zip` do sistema SHOficina para a oficina Paulinho Autocar, preservando clientes, veículos, ordens de serviço, itens e fotos sem duplicar registros em reexecuções e sem inventar dados financeiros ou consentimentos.

## Fonte validada

- Arquivo ZIP com hash SHA-256 `94F70458B0011C3FB514FFFA860B21E581869557289C67982CF13C501408C6F1`.
- Banco Access Jet 4 protegido, lido somente em modo read-only.
- 498 clientes, 581 veículos, 1.252 ordens, 1.170 serviços, 3.945 peças, 7 serviços de catálogo e 20 fotos de 7 ordens.
- 51 ordens apontam para cliente inexistente no legado; 68 não possuem vínculo válido com veículo.
- O campo `SERIE` contém a placa; `DESCRICAO` contém veículo/ano; `MARCA` contém a marca; `MODELO` contém a cor; `PAT` contém o chassi.

## Abordagem escolhida

Será usado um importador local, idempotente e executado em duas fases:

1. `dry-run` extrai e transforma os dados, consulta a oficina de destino e mostra apenas contagens e alertas, sem dados pessoais.
2. `commit` grava tudo em transação e registra a proveniência de cada entidade importada.

Uma importação CSV foi descartada porque perderia vínculos, itens e fotos. Uma carga direta sem rastreabilidade foi descartada porque não permitiria reexecução segura.

## Segurança e privacidade

- O ZIP nunca será incluído no Git.
- A carga desta migração aceita somente o SHA-256 aprovado; um novo backup exige nova auditoria e atualização explícita do hash esperado.
- A senha do MDB é decodificada apenas em memória e nunca é impressa ou persistida.
- O extrator abre o MDB somente para leitura.
- Relatórios de terminal mostram somente contagens, identificadores legados e alertas técnicos; não exibem nomes, telefones, documentos ou endereços.
- Clientes importados recebem `whatsappConsent = false`, pois a base legada não comprova consentimento.
- A conexão de produção é lida por variável de ambiente e não é gravada no projeto.

## Rastreabilidade e idempotência

Duas tabelas serão acrescentadas:

- `legacy_import_runs`: identifica a execução, oficina, sistema de origem, hash do arquivo, estado e resumo.
- `legacy_import_mappings`: liga `tipo + id legado` ao UUID criado ou reutilizado no sistema atual.

Uma restrição única por oficina, sistema, tipo e ID legado impede duplicação. Uma nova execução do mesmo backup resulta em zero novas entidades, salvo importações interrompidas que ainda não tenham mapeamento concluído.

## Regras de transformação

### Clientes

- Nome é obrigatório e vem de `CLIENTES.NOME`.
- Telefone prioriza celular e depois telefone; é normalizado para buscas.
- Documento e endereço são preservados quando disponíveis.
- Reuso de cliente existente somente por documento normalizado exato ou combinação segura de nome normalizado e telefone normalizado.
- Ordens cujo cliente não existe no legado apontam para um cliente técnico único chamado `Cliente legado não identificado`.

### Veículos

- Marca: `EQUIPAMENTOS.MARCA`.
- Modelo/descrição e ano: extraídos de `EQUIPAMENTOS.DESCRICAO`.
- Cor: `EQUIPAMENTOS.MODELO`.
- Placa: `EQUIPAMENTOS.SERIE`, normalizada.
- Chassi: `EQUIPAMENTOS.PAT`.
- Reuso de veículo existente somente por placa válida normalizada.
- Placa ausente ou inválida recebe identificador visível e único `SEMPLACA-<código legado>`; `plateNormalized` fica nulo.
- Placas duplicadas no legado são preservadas sem violar a restrição única: a primeira mantém a placa e as demais recebem sufixo legado, com a placa original registrada nas observações de importação.

### Ordens de serviço

- O número legado é preservado quando estiver livre.
- Em colisão com ordem já existente, o importador reserva o próximo número disponível e registra o número legado nas observações e no mapeamento.
- Cliente é obrigatório; veículo pode ficar nulo quando não for possível recuperar o vínculo.
- Datas, reclamação, diagnóstico/laudo, observações, quilometragem, garantia e valores são preservados.
- Situações legadas são convertidas para os estados atuais:
  - entregue reparado: `delivered`;
  - pronto: `ready`;
  - autorizado/em reparo/aguardando peça: `in_progress`;
  - aguardando autorização: `awaiting_approval`;
  - aguardando avaliação: `diagnosis`;
  - condenado: `cancelled`;
  - sem situação: `delivered` quando há saída; caso contrário `open`.
- Itens de `OS_SERVICOS` entram como mão de obra e itens de `OS_PECAS` como peças históricas sem movimentar o estoque atual.
- O total da OS vem dos totais legados. Diferenças entre itens e total são documentadas sem criar pagamentos fictícios.
- Ordens importadas não geram pagamentos, taxas de cartão ou lançamentos financeiros, porque o legado não fornece liquidação e forma de pagamento confiáveis.

### Fotos

- O padrão `O<OS com 6 dígitos><índice>.Bmp` liga cada foto à ordem correspondente.
- As 20 imagens são importadas como fotos de diagnóstico e mantidas privadas pela autorização já existente.

## Atomicidade e recuperação

- A carga principal ocorre em uma transação.
- O registro da execução muda para `completed` somente depois do sucesso.
- Uma execução obtém uma trava lógica exclusiva antes de gravar; uma segunda execução concorrente é recusada sem alterar o estado da primeira.
- Em falha, a transação é revertida e a execução recebe estado `failed` com mensagem técnica sem PII.
- Qualquer serviço, peça ou foto sem OS correspondente impede o `commit`; o `dry-run` informa os contadores para correção.
- A sequência de novas ordens é atualizada para um número acima do maior número efetivamente ocupado.

## Critérios de aceite

- `dry-run` mostra as contagens esperadas e nenhuma escrita.
- `commit` importa ou reutiliza todas as entidades mapeáveis.
- Todas as 1.252 ordens são preservadas, inclusive as órfãs.
- Todos os 5.115 itens são ligados à ordem correta.
- As 20 fotos ficam ligadas às 7 ordens esperadas.
- Reexecutar o importador não cria duplicidades.
- Testes cobrem normalização, mapeamento de status, órfãos, placas duplicadas, colisão de número e idempotência.
