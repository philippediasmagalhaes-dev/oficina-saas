# Referências para profissionalizar o Oficina SaaS

**Gerado:** 2026-10-26  
**Profundidade:** varredura rápida, com foco em arquitetura da informação, financeiro e densidade visual.

## Diagnóstico do produto atual

O produto já cobre boa parte da rotina da oficina, mas sua apresentação ainda tem três marcas de MVP:

1. **Navegação plana:** onze destinos aparecem com o mesmo peso. Operação, relacionamento, financeiro e configuração não formam grupos reconhecíveis.
2. **Excesso de superfícies:** quase tudo vira card grande com borda, raio e sombra. Como os elementos parecem igualmente importantes, o olhar não encontra rapidamente urgências e ações.
3. **Financeiro monolítico:** filtros, quatro indicadores, contas a pagar e receber misturadas, nova receita/despesa, categorias, indicadores comerciais, gráfico e rankings ficam na mesma página.

## Padrões do mercado

| Referência | Padrão útil para o Oficina SaaS |
| --- | --- |
| Dono da Oficina | Dashboard orientado ao dia, módulos agrupados, alertas em faixa, cards pequenos de status e financeiro com abas. |
| Ultracar | Pagar, receber, fluxo, balancete e DRE tratados como visões distintas do financeiro. |
| WorkMotor | Arquitetura por áreas de negócio, caixa diário e indicadores gerenciais separados da operação. |
| Conta Azul | Estados financeiros claros, filtros rápidos por vencimento, tabela configurável e separação entre vencimento, baixa e competência. |

## Direção recomendada

Adotar uma **estrutura operacional profissional**, preservando o escopo simples da oficina e evitando transformar o produto em um ERP genérico.

### Navegação

- **Início:** Visão geral.
- **Operação:** Ordens de Serviço, Clientes, Veículos, Estoque e Serviços.
- **Relacionamento:** Retenção.
- **Gestão:** Financeiro e Colaboradores.
- **Sistema:** Notificações e Configurações.

No celular, usar uma barra curta com Início, OS, Clientes e Financeiro, mais um menu “Mais”. A barra atual com todos os módulos cria rolagem horizontal e reduz legibilidade.

### Dashboard

Trocar a grade de sete cards grandes por:

- cabeçalho compacto com botão “Nova OS”;
- quatro indicadores: faturado no mês, recebido, a receber e OS em andamento;
- faixa de alertas para atrasos, estoque baixo e retornos;
- fluxo da oficina por status em cards pequenos;
- blocos “Hoje na oficina” e “Pendências que exigem ação”.

### Financeiro

Criar cinco visões: **Visão geral, Contas a receber, Contas a pagar, Caixa e Relatórios**.

- Visão geral: saldo, previsto, vencido, gráfico de fluxo e alertas.
- A receber: vencidas, vencem hoje, a vencer, recebidas e parciais.
- A pagar: vencidas, vencem hoje, a vencer e pagas.
- Caixa: movimentos baixados, forma de pagamento, taxas e saldo diário.
- Relatórios: competência, resultado, impostos, comissões e exportação Business Fin.

Cada listagem deve usar tabela densa com origem, pessoa/fornecedor, categoria, vencimento, status, valor, saldo e ação. “Nova receita/despesa” abre em painel lateral ou modal. Categorias e taxas saem da rotina principal e ficam em Configurações.

### Linguagem visual

- Fundo neutro claro e sidebar escura inspirada na identidade Paulinho Autocar.
- Vermelho da marca para ação principal e seleção; amarelo apenas para atenção; verde para concluído/recebido.
- Raio entre 10 e 12 px, sombras discretas e fim do efeito de vidro nas telas operacionais.
- Títulos funcionais: “Financeiro”, “Contas a receber”, “OS em andamento”. Evitar frases de marketing dentro do sistema.
- Linhas de tabela entre 44 e 48 px, números monetários alinhados e status em etiquetas compactas.
- Cards reservados a resumo, alerta e agrupamento; dados repetitivos ficam em listas e tabelas.

## Abordagens consideradas

### 1. Polimento visual

Altera cores, bordas, fontes e tamanhos, preservando a estrutura. É rápido, mas não corrige o financeiro monolítico nem a navegação plana.

### 2. Reestruturação de produto — recomendada

Refaz navegação, dashboard e financeiro, reaproveitando regras e banco atuais. Entrega a maior mudança de percepção com risco controlado.

### 3. ERP completo

Além da interface, adiciona contas bancárias, fornecedores, parcelas, recorrências, conciliação e DRE contábil. É uma boa fase futura, mas amplia demais o piloto atual.

## Ordem sugerida

1. Criar o novo shell e sistema visual.
2. Refazer Dashboard.
3. Separar Financeiro em visões.
4. Implementar vencimento, fornecedor, baixa parcial e parcelamento.
5. Revisar OS, clientes, veículos, estoque e colaboradores com a nova linguagem.

## Limites desta pesquisa

- Foram analisadas páginas e capturas públicas dos fornecedores em 2026-10-26.
- Recursos não mostrados publicamente não foram considerados ausentes.
- Métricas de SEO e participação de mercado não foram avaliadas porque não ajudam a decisão de interface e arquitetura deste projeto.

