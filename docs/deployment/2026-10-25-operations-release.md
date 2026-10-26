# Paulinho Autocar — atualização operacional de 25/10/2026

Endereço oficial: https://oficina-saas.contato-ad4.workers.dev

## Alterações entregues

| Solicitação | Implementação |
| --- | --- |
| Error 1102 | Paginação de 24 registros e filtros no banco para clientes, veículos e OS; agrupamentos de histórico sem varreduras quadráticas no Worker. |
| Listas compactas e pesquisar cliente | Cards menores, busca por nome/contato/documento, placa/modelo/cliente e OS/serviço. |
| Editar/excluir remuneração | Editar regra principal, editar/excluir exceções por serviço e desativar colaborador preservando histórico. |
| Relatório de comissões | Mês selecionável, fixo/comissão, pago/a pagar e link para registrar pagamento no financeiro. |
| Categorias financeiras | Categorias iniciais para oficina, criar/editar/desativar próprias e renomear categorias do sistema. |
| Taxas de cartão | Regras por forma e número de parcelas, edição/exclusão, prévia de taxa e líquido na finalização. |
| Pagamento recebido | Indica baixa de caixa. Desmarcado mantém contas a receber. Configuração das taxas em Configurações. |
| Campos numéricos | Valores monetários com centavos/vírgula automática; seleção completa ao focar números. Campos opcionais vazios mantêm a regra padrão. |
| WhatsApp | Botão de compartilhar OS publicada; apenas uma ação de aviso de pronto; retenção e aviso manual abrem outra aba. |
| Aviso automático de pronto | Acionado na mudança para pronto tanto pelo proprietário quanto pelo mecânico, condicionado à API oficial configurada e consentimento. |
| Retenção por serviço e km | Último serviço por veículo, prazo por serviço, óleo do motor em seis meses ou antes pela frequência observada, alvo de km e mensagem contextual. Óleo de câmbio/diferencial não é confundido com motor. |
| Serviços de mecânica | Catálogo inicial idempotente; preços começam em zero para a oficina definir, com dias/km editáveis. |
| Consentimento WhatsApp da base | Ação em Retenção para o proprietário declarar autorização prévia; registra fonte/data e preserva opt-outs. Não aplicada automaticamente durante o desenvolvimento. |
| Entrada por nota fiscal | NF-e XML de até250KB/50produtos, revisão de destino e quantidade antes de confirmar. Entrada transacional e idempotente por chave. Foto/PDF OCR não incluído. |
| Mapa de avarias | Desenho com cinco vistas, marcações e observações; reprodução na OS impressa. |
| Notificação de aprovação | Aviso no app, atualização por minuto e página com aprovações recentes. |
| Página do mecânico | Link de8horas por OS, sem conta de funcionário nem preços; diagnóstico, km, execução, vistoria, fotos e conclusão. |

## Como calcular a remuneração

A comissão considera a mão de obra depois do desconto e a participação atribuída ao colaborador; peças não entram na base. Com R$500 de mão de obra, participação de50% e comissão de20%, a comissão é R$50. Um valor fixo por serviço, quando configurado no modelo híbrido, é somado. O fixo mensal gera um lançamento mensal separado. Uma exceção por serviço substitui somente o campo preenchido; campo vazio usa a regra principal. O fechamento financeiro da OS preserva os valores do histórico mesmo após editar/excluir uma regra.

## Verificações e limites

- 235 testes passaram; 1 teste de integração depende de TEST_DATABASE_URL e permaneceu desativado.
- TypeScript e build Cloudflare passaram. Auditoria das dependências de produção:0 vulnerabilidades.
- Smoke público:22/22; novas rotas de notificação e geração de acesso mecânico exigem login; link mecânico inválido mostra acesso expirado.
- Migrações0010–0012 aplicadas em transação no projeto Neon `oficina`, branch `production`, com registro no journal Drizzle.
- Base preservada:496 clientes e1253 OS antes/depois das migrações.
- Consulta real de retenção:522 registros agrupados,14 trocas de óleo,10 candidatos no dia da validação; nenhum WhatsApp enviado no teste.
- A revisão independente encontrou problemas de persistência do formulário mecânico e de priorização/agendamento dos retornos; corrigidos com testes e validação SQL.
- A navegação autenticada e o consumo de CPU das listas publicadas ainda precisam ser conferidos com a sessão do proprietário; a aba disponível estava na tela de login.
- Os formulários de cadastro e edição também usam busca de clientes sob demanda (20 resultados) e carregam apenas os veículos do cliente selecionado; a base inteira não é enviada ao navegador.

## Configuração ainda necessária

1. Informar os percentuais reais da maquininha para1x,2x,3x etc., a reserva de imposto e os preços/intervalos do catálogo.
2. Conferir a autorização real da base antes de usar a ação de consentimento em lote.
3. Para mensagens automáticas, configurar a Meta WhatsApp Cloud API e templates: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_WORKSHOP_ID, WHATSAPP_REMINDER_TEMPLATE_NAME, WHATSAPP_READY_TEMPLATE_NAME e CRON_SECRET. Webhook exige também os segredos de verificação/assinatura. Incluir as mesmas bindings no arquivo Cloudflare ao ativar para preservá-las em próximos deploys. Os links manuais funcionam sem essa integração.
4. O agendador trabalha com até24 candidatos por execução, com cursor persistido; o cron roda entre9h e17h de São Paulo. A integração desconfigurada não envia mensagens.
5. A importação é pelo XML da NF-e. Leitura de nota por fotografia/PDF é uma extensão futura.

