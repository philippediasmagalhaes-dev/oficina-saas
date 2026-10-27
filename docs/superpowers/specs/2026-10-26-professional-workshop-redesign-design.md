# Oficina SaaS — reestruturação profissional

## Intenção

Transformar o piloto da Paulinho Autocar em um produto operacional com aparência e organização de software profissional, mantendo a simplicidade para uma oficina pequena. A mudança cobre toda a arquitetura visual e entrega um financeiro operacional confiável, sem assumir a complexidade de um ERP fiscal ou bancário.

## Objetivos

- Organizar a navegação por áreas de trabalho reconhecíveis.
- Diminuir a sensação de “caixas dentro de caixas”, usando cards só para resumo e alerta.
- Fazer o dashboard responder o que exige atenção hoje e como está o mês.
- Separar visão geral, contas a receber, contas a pagar, caixa e relatórios.
- Suportar fornecedores, contas financeiras, parcelas, recorrência, baixas parciais e fechamento de caixa.
- Integrar OS, taxas de cartão, impostos, comissões e entrada por NF-e ao financeiro.
- Preservar os dados existentes e manter o funcionamento na Cloudflare com Neon.

## Fora do escopo

- Conciliação bancária automática por Open Finance.
- Emissão fiscal e escrituração contábil oficial.
- Plano de contas contábil completo, balanço patrimonial ou obrigações acessórias.
- Login de funcionário. O acesso do mecânico continua por link temporário e sem valores.
- Mudança da integração Business Fin além de enriquecer os dados exportados já disponíveis.

## Arquitetura da informação

O menu lateral terá os grupos:

- **Início:** Visão geral.
- **Operação:** Ordens de Serviço, Clientes, Veículos, Estoque e Serviços.
- **Relacionamento:** Retenção.
- **Gestão:** Financeiro e Colaboradores.
- **Sistema:** Notificações e Configurações.

No celular, a barra fixa terá Início, OS, Clientes, Financeiro e Mais. “Mais” abre os destinos restantes em uma folha de navegação.

## Linguagem visual

- Fundo cinza claro neutro e superfícies brancas sólidas.
- Sidebar preta, seleção e ações primárias no vermelho Paulinho Autocar.
- Amarelo/âmbar reservado para atenção e vencimentos; verde para recebido e concluído.
- Raio de 10 a 12 px, sombras discretas e sem vidro nas telas operacionais.
- Títulos funcionais e compactos; frases promocionais deixam as áreas autenticadas.
- Tabelas com linhas de 44 a 48 px, valores alinhados e etiquetas de status.
- Escala de espaçamento baseada em 4/8 px e números financeiros com algarismos tabulares.

## Dashboard

O topo mostra “Visão geral”, o período e “Nova OS”. A primeira faixa terá quatro indicadores: faturado no mês, recebido, a receber e OS em andamento. Abaixo haverá alertas acionáveis para contas vencidas, veículos prontos, estoque baixo e retornos. O fluxo operacional exibirá os estados da OS em cards compactos. “Hoje na oficina” e “Pendências” substituem a tabela isolada de serviços do mês; o histórico mensal permanece acessível no financeiro.

## Financeiro

### Visão geral

Mostra saldo de caixa, entradas, saídas, valores vencidos e previsão dos próximos 30 dias. Também exibe fluxo por período, contas urgentes e atalhos para novo recebimento ou despesa.

### Contas a receber

Filtros rápidos: Vencidas, Vencem hoje, A vencer, Parciais e Recebidas. A tabela apresenta origem, cliente, descrição, vencimento, forma, valor original, saldo e ação. Receitas de OS são geradas automaticamente.

### Contas a pagar

Filtros equivalentes para despesas. A tabela inclui fornecedor ou colaborador, categoria, vencimento, valor, saldo e ação. Comissões e remunerações aparecem como contas a pagar.

### Caixa

Registra contas financeiras (caixa físico, banco, PIX e maquininha), baixas realizadas, taxas e saldo por conta. Permite abrir e fechar o caixa diário, comparando saldo calculado e informado.

### Relatórios

Reúne visão por competência, fluxo realizado e previsto, resultado gerencial, impostos reservados, taxas, comissões e exportação Business Fin.

## Modelo financeiro

- `financial_accounts`: contas onde o dinheiro entra ou sai.
- `suppliers`: fornecedores da oficina, reutilizados pela NF-e e pelas despesas.
- `financial_entries`: título a pagar/receber, com cliente/fornecedor/conta, grupo de parcelas, número da parcela, documento e observação.
- `financial_settlements`: cada baixa, permitindo pagamentos parciais, taxa, forma de pagamento, conta e estorno preservando histórico.
- `cash_sessions`: abertura e fechamento de caixa com valor inicial, calculado e declarado.

O saldo de um título é `valor bruto - baixas não estornadas`. Zero deixa o título quitado; entre zero e o total deixa parcial; sem baixa mantém previsto. A data de vencimento não é substituída pela data de baixa. Os lançamentos antigos quitados continuam válidos mesmo sem detalhamento de conta.

## Integrações operacionais

- Finalização da OS continua gerando títulos por forma de pagamento e parcela.
- Taxas da maquininha reduzem o valor líquido da baixa, sem reduzir a dívida bruta do cliente.
- Comissão e remuneração geram contas a pagar.
- Importação de NF-e pode gerar fornecedor e conta a pagar após revisão explícita.
- Reserva de imposto aparece nos relatórios, sem ser tratada como dinheiro livre.

## Segurança e dados

Toda consulta e mutação permanece limitada por `workshopId`. Migrações são aditivas, mantêm a base existente e não removem dados. Alterações de estado financeiro criam histórico ou estorno; títulos vinculados a uma OS não podem ser apagados silenciosamente.

## Abordagens consideradas

1. **Polimento visual:** rápido, mas mantém a navegação plana e o financeiro monolítico.
2. **Reestruturação visual completa com financeiro operacional:** escolhida por equilibrar profissionalização, utilidade e risco.
3. **ERP completo:** adicionaria conciliação bancária automática e contabilidade/fiscal avançada, aumentando custo e preenchimento sem benefício proporcional neste piloto.

