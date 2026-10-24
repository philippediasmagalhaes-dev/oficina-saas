# Plano de implementação — importação SHOficina

## 1. Contrato e testes de transformação

- Criar tipos do conjunto de dados legado.
- Escrever testes para normalização de telefone, documento, placa, valores, datas e extração de ano/modelo.
- Escrever testes para o mapeamento de situações e para nomes de fotos.

## 2. Extrator Access somente leitura

- Criar um script PowerShell para extrair somente `Dados.MDB` e fotos válidas do ZIP.
- Decodificar a proteção Jet 4 apenas em memória.
- Ler as tabelas necessárias com ACE OLEDB em modo read-only.
- Emitir JSON para o importador e limpar temporários ao terminar.

## 3. Proveniência no banco

- Adicionar `legacy_import_runs` e `legacy_import_mappings` ao schema Drizzle.
- Criar a migração SQL com índices, chaves estrangeiras e restrições únicas.
- Adicionar testes de schema e idempotência.

## 4. Planejador de importação

- Produzir um plano determinístico de clientes, veículos, catálogo, ordens, itens e fotos.
- Resolver clientes/veículos existentes, órfãos, placas duplicadas e colisões de número.
- Gerar relatório agregado sem PII.

## 5. Gravador transacional

- Executar a carga em transação.
- Registrar mapeamentos depois de cada entidade criada ou reutilizada.
- Atualizar a sequência de OS ao final.
- Não criar pagamentos nem movimentações de estoque.

## 6. Interface de linha de comando

- Adicionar `npm run db:import-shoficina -- --zip <arquivo>` para simulação.
- Exigir `--commit` para gravar.
- Permitir seleção explícita de oficina quando existir mais de uma.
- Garantir que mensagens de erro não revelem segredo ou PII.

## 7. Validação e produção

- Executar testes unitários, integração possível, typecheck e build.
- Executar `dry-run` com o backup recebido.
- Aplicar migração de schema.
- Executar importação com `--commit` na oficina Paulinho Autocar.
- Reexecutar `dry-run` para comprovar idempotência.
- Validar contagens no Neon e fazer smoke test autenticado do app.
