# Plano de implementação — acabamento do piloto e dados

**Spec:** `docs/superpowers/specs/2026-10-27-pilot-polish-data-design.md`

## Task 1 — Relatório financeiro por categoria

- Criar testes para agregação por categoria, incluindo taxa líquida, cancelados e percentuais.
- Implementar agregador puro e integrá-lo a `getFinancialDashboard`.
- Renderizar receitas e despesas por categoria na página de relatórios.
- Verificar testes direcionados e tipos.

## Task 2 — Colaborador e painel de movimentações

- Criar testes de apresentação/contrato para exclusão lógica e controle expansível.
- Renomear a ação visível para “Excluir colaborador”, com explicação da preservação histórica.
- Tornar o acionador de movimentações explícito, acessível e estável dentro da tabela.
- Verificar testes direcionados.

## Task 3 — Controles e rolagem

- Criar teste de contrato CSS para checkbox, botões e scrollbar.
- Implementar estilos globais alinhados, foco acessível e scrollbar da marca.
- Verificar teste direcionado e responsividade pelo build.

## Task 4 — Normalização auditável do piloto

- Criar testes para distribuição determinística e equilibrada de datas ausentes.
- Implementar função pura de distribuição e script `db:prepare-pilot-data` com prévia padrão e `--apply`.
- Consultar a base, executar prévia, aplicar em transação e verificar contagens/meses.

## Task 5 — Validação e entrega

- Executar suíte completa, tipos, build Next, build Cloudflare e auditoria de produção.
- Fazer revisão final independente do branch e corrigir achados importantes com RED→GREEN.
- Commitar, publicar branch, integrar e fazer deploy Cloudflare.
- Executar smoke test e confirmar dados no Neon.
