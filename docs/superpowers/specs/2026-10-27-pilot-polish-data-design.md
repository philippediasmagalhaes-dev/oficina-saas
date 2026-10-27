# Acabamento do piloto e normalização de dados

## Objetivo

Elevar a consistência visual e funcional do piloto da Paulinho Autocar, corrigir a baixa financeira e preparar a base existente para demonstração sem apagar histórico real.

## Decisões

- Botões, campos e checkboxes compartilham altura, alinhamento, foco e estados visuais. A rolagem usa o vermelho da marca e mantém contraste acessível.
- “Excluir colaborador” é uma desativação lógica. O colaborador deixa de aparecer em novas atribuições, mas comissões e OS antigas continuam íntegras.
- “Movimentações” de contas a pagar abre um painel de baixa claramente acionável, inclusive por teclado e em tabelas estreitas.
- O relatório financeiro exibe receitas e despesas agrupadas por categoria, respeitando período e regime (caixa/competência). Categorias sem cadastro usam um nome legível derivado da chave.
- Todos os clientes recebem `whatsapp_consent = true`, data e origem auditável. Opt-outs já registrados não são apagados.
- Todas as OS passam a `completed`. Datas existentes são preservadas. Somente OS sem `completed_at` recebem datas determinísticas e equilibradas nos 12 meses anteriores, nunca no futuro.
- A alteração da base é feita por script idempotente com modo de prévia e transação no modo `--apply`.

## Critérios de aceite

1. Controles ficam visualmente alinhados no desktop e mobile; checkbox não herda largura/altura de campo de texto.
2. O painel “Movimentações” abre e oferece baixa quando há saldo; histórico permanece visível quando liquidado.
3. A ação “Excluir colaborador” remove o profissional das opções futuras e conserva registros anteriores.
4. Relatórios mostram listas separadas de receitas e despesas por categoria com valor e participação percentual.
5. O script informa quantos clientes e OS serão alterados antes de aplicar, pode ser executado novamente sem redistribuir datas e preserva datas existentes.
6. Testes, tipos e builds Next/Cloudflare passam; o ambiente publicado responde sem erro 1102.
