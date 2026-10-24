# Runbook do piloto Paulinho Car na Cloudflare

Este procedimento publica o mesmo commit em Cloudflare Workers e Vercel, mantém o Neon como banco único e usa um bucket R2 privado para fotos. A Vercel permanece disponível como retorno até o piloto ser considerado estável.

## Regras de segurança e de continuidade

- Faça todas as etapas a partir de um commit já aprovado na matriz local de testes.
- Nunca coloque valores secretos em arquivos versionados, prints, tickets ou comandos que fiquem no histórico do terminal.
- O bucket R2 deve continuar privado, sem domínio público e sem `r2.dev` público.
- Não exclua o projeto Vercel, as tabelas do Neon, objetos do R2 ou fotos Base64 nesta versão.
- Não altere a URL canônica antes de validar a URL temporária do Worker e o retorno pela Vercel.
- Interrompa o corte se login, isolamento da oficina, fotos, migração ou qualquer fluxo principal falhar.

## Variáveis obrigatórias

Cadastre os nomes abaixo nos ambientes Cloudflare e Vercel. Não copie valores para este documento.

| Nome | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão pooled do Neon |
| `BETTER_AUTH_URL` | Origem canônica da aplicação no ambiente |
| `BETTER_AUTH_SECRET` | Mesmo segredo forte nos dois destinos |
| `NEXT_PUBLIC_APP_URL` | URL pública canônica usada pelo aplicativo |
| `AUTH_TRUSTED_ORIGINS` | Origens Cloudflare e Vercel, separadas por vírgula |
| `R2_ACCOUNT_ID` | Conta proprietária do bucket |
| `R2_ACCESS_KEY_ID` | Chave S3 restrita ao bucket |
| `R2_SECRET_ACCESS_KEY` | Segredo da chave S3 |
| `R2_BUCKET_NAME` | Nome do bucket privado |

Variáveis opcionais para liberar integrações externas depois do deploy:

| Nome | Uso |
| --- | --- |
| `PLATE_LOOKUP_PROVIDER`, `PLATE_LOOKUP_API_URL`, `PLATE_LOOKUP_API_TOKEN` | Consulta assistida por placa |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_WORKSHOP_ID` | Meta WhatsApp Cloud API vinculada explicitamente à oficina |
| `WHATSAPP_REMINDER_TEMPLATE_NAME`, `WHATSAPP_READY_TEMPLATE_NAME`, `WHATSAPP_GRAPH_API_VERSION` | Templates aprovados de manutenção e veículo pronto |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | Verificação e assinatura do webhook |
| `CRON_SECRET` | Proteção da execução diária de lembretes |

O Worker possui um agendamento diário às 12:00 UTC (09:00 de Brasília). Sem `CRON_SECRET` e as credenciais completas da Meta, ele encerra com segurança e o envio manual permanece disponível.

### Ativar consulta por placa com FipePlaca

A consulta usa somente a rota cadastral `GET /placa/{placa}`, atualmente informada pelo provedor a R$ 0,08 por resultado entregue. Ela não chama a rota FIPE adicional. O cadastro manual continua disponível quando a integração está sem saldo, desconfigurada ou indisponível.

1. Crie a conta em `https://www.fipeplaca.com.br/` e confirme o e-mail.
2. Faça a recarga pré-paga mínima indicada no painel — a documentação pública informa R$ 30,00 no momento deste runbook.
3. Crie uma chave de API. Ela começa com `fp_live_` e aparece completa uma única vez; guarde-a diretamente no gerenciador de segredos.
4. Configure no Worker:
   - `PLATE_LOOKUP_PROVIDER=fipeplaca` como variável comum;
   - `PLATE_LOOKUP_API_TOKEN` como segredo;
   - deixe `PLATE_LOOKUP_API_URL` vazia para usar o endpoint oficial padrão da integração.
5. Implante novamente e faça uma consulta de placa real conhecida. Confira os dados antes de salvar o veículo.
6. Acompanhe saldo e extrato no painel FipePlaca. O formulário informa o saldo retornado pelo provedor após uma consulta paga.

Resultados salvos para a mesma placa e oficina são reaproveitados por 30 dias sem nova chamada. O botão também bloqueia repetição imediata enquanto a placa não for alterada. O provedor não entrega Renavam nem dados do proprietário nessa rota; não adicione integrações paralelas para obter esses dados no piloto.

A funcionalidade só fica ativa depois que `PLATE_LOOKUP_API_TOKEN` estiver cadastrado e houver saldo. Sem isso, o sistema orienta o preenchimento manual e não bloqueia o cadastro.

`OWNER_EMAIL`, `OWNER_PASSWORD` e `OWNER_NAME` só são usados para criar o primeiro proprietário. Não os mantenha configurados depois do seed.

## 1. Preparar a conta Cloudflare e o R2

1. Entre na conta Cloudflare que será responsável pelo piloto e habilite R2.
2. Crie o bucket privado indicado por `R2_BUCKET_NAME`. Pela CLI autenticada, a operação equivalente é `npx cf r2 buckets create --name <nome-do-bucket>`.
3. Confirme no painel que não existe acesso público, domínio personalizado ou endereço público `r2.dev` para o bucket.
4. Em **R2 > Manage R2 API Tokens**, crie uma chave S3 com leitura e gravação limitada somente a esse bucket.
5. Registre `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY` diretamente no gerenciador seguro de variáveis. O segredo da chave pode ser mostrado apenas uma vez.
6. Autentique a estação de implantação com `npx cf auth login`. Use o perfil correto se a máquina possuir mais de uma conta.

O aplicativo acessa R2 pela API S3 assinada no servidor; ele não requer nem deve receber uma URL pública do bucket.

## 2. Verificação local antes de publicar

Execute, no commit candidato:

```bash
npm ci
npm test
npm run typecheck
npm run build
npx vinext check
npm run build:cloudflare
npm audit --omit=dev
git diff --check
```

Critérios de avanço:

- todos os testes passam; o teste de banco pode aparecer como ignorado somente quando `TEST_DATABASE_URL` não estiver configurado;
- os builds Next/Vercel e Cloudflare terminam com sucesso;
- `vinext check` não apresenta recurso parcial ou incompatível;
- não existe vulnerabilidade de produção alta ou crítica;
- o diretório de trabalho está limpo e o commit verificado é o mesmo que será implantado.

## 3. Preparar banco e fotos sem perda de dados

Disponibilize `DATABASE_URL` e as quatro variáveis R2 apenas no ambiente seguro do operador. Depois:

1. aplique o schema com `npm run db:migrate`;
2. execute `npm run db:migrate-photos:r2 -- --dry-run` e registre a contagem `candidate`;
3. execute `npm run db:migrate-photos:r2`;
4. repita `npm run db:migrate-photos:r2 -- --dry-run` e exija `candidate=0`;
5. se houver `failed` maior que zero, não faça o corte: corrija a causa e repita o comando idempotente;
6. mantenha `data_base64` no Neon, mesmo após todas as fotos terem `storage_key`.

O comando verifica o número de bytes salvo no R2 antes de registrar a chave no banco. Uma falha não apaga a cópia antiga e não impede a tentativa das fotos restantes.

## 4. Implantar na URL temporária do Worker

1. Execute `npm run deploy:cloudflare` e anote a URL `workers.dev` retornada.
2. No painel **Workers & Pages > oficina-saas > Settings > Variables and Secrets**, cadastre todas as variáveis da tabela. Use campos secretos inclusive para as credenciais de banco, autenticação e R2.
3. Para a validação temporária, use a URL `workers.dev` em `BETTER_AUTH_URL` e `NEXT_PUBLIC_APP_URL`. Em `AUTH_TRUSTED_ORIGINS`, inclua a origem `workers.dev` e a origem Vercel.
4. Implante novamente o mesmo commit com `npm run deploy:cloudflare` para garantir que código e configuração estejam sincronizados.
5. Não promova a URL para o usuário ainda.

## 5. Smoke público automatizado

Execute:

```bash
npm run smoke:deployment -- https://<worker-temporario>.workers.dev
```

O comando não autentica, não altera dados e não imprime cookies ou corpos de resposta. Ele valida:

- tela pública de login do proprietário;
- manifesto instalável;
- service worker, logo e todos os ícones;
- proteção de uma URL aleatória de foto;
- proteção de dashboard, edição de cliente/veículo, OS, impressão A4, colaboradores, financeiro, estoque, retenção e configurações;
- proteção da consulta de placa e da exportação Business Fin;
- rejeição do cron sem segredo e resposta segura para orçamento público inexistente;
- ausência de redirecionamento para outra origem.

Qualquer falha bloqueia o corte.

## 6. Checklist autenticado e manual

Use uma janela privada e dados de teste identificáveis. Confirme, nesta ordem:

- [ ] login do proprietário, recarga com sessão persistente e logout;
- [ ] painel mostra somente a oficina atual e os serviços do período esperado;
- [ ] criação e edição de um cliente de teste;
- [ ] criação de veículo, incluindo placa, e abertura do histórico;
- [ ] criação de ordem, diagnóstico, itens/orçamento e mudanças de status;
- [ ] upload de foto, abertura autenticada e bloqueio da mesma URL após logout;
- [ ] geração e abertura do link público do orçamento;
- [ ] visualização de impressão A4 da ordem;
- [ ] finalização do serviço e cálculo da próxima manutenção;
- [ ] retenção e link manual de WhatsApp com a URL correta;
- [ ] movimentação de estoque e saldo sem valor negativo;
- [ ] painel financeiro, filtros e totais coerentes;
- [ ] instalação da PWA e abertura em modo standalone;
- [ ] dados sensíveis não aparecem disponíveis offline após desconectar a rede.

Exclua apenas os registros de teste que forem seguros e claramente identificados. Não use este roteiro para apagar dados reais.

## 7. Preparar e provar a Vercel como retorno

Antes do corte:

1. adicione ao projeto Vercel as mesmas quatro variáveis R2 e `AUTH_TRUSTED_ORIGINS` com as duas origens;
2. mantenha o mesmo `DATABASE_URL` e `BETTER_AUTH_SECRET` usados pelo Worker;
3. implante exatamente o mesmo commit na Vercel;
4. na URL Vercel, faça login e abra pelo menos uma foto migrada e uma foto nova criada pelo Worker;
5. confirme geração de orçamento e carregamento das páginas principais;
6. não remova o deployment Vercel anterior.

Se a Vercel não ler a mesma foto no R2, o retorno não está pronto e o corte fica bloqueado.

## 8. Corte da URL canônica

Somente depois de todas as verificações:

1. registre os resultados, o hash do commit e as contagens da migração;
2. defina no Worker `BETTER_AUTH_URL` e `NEXT_PUBLIC_APP_URL` com a URL escolhida para produção;
3. mantenha as origens Worker e Vercel em `AUTH_TRUSTED_ORIGINS`;
4. implante novamente e repita o smoke público e login/logout;
5. altere na Vercel `BETTER_AUTH_URL` e `NEXT_PUBLIC_APP_URL` para a mesma URL canônica e gere um deployment do mesmo commit;
6. só então entregue a nova URL ao proprietário e instale a PWA no dispositivo de uso.

Sem domínio comprado, a URL canônica inicial é a própria URL `workers.dev`. A compra e configuração de domínio continuam fora deste piloto.

## 9. Monitoramento e limite do plano gratuito

Durante o teste e nos primeiros dias, acompanhe **Workers & Pages > oficina-saas > Observability** e o painel de uso da conta:

- erros 5xx, exceções, duração e consumo de CPU;
- erro de limite de CPU, inclusive código 1102;
- volume de requisições do Worker;
- operações e armazenamento do R2;
- falhas de conexão e latência do Neon.

Bloqueie ou reverta o corte quando qualquer fluxo válido atingir limite de CPU, houver erros repetidos de autenticação/R2, ou o uso projetado superar 80% de uma cota gratuita durante o período normal da oficina. Nesse caso, escolha conscientemente entre o plano pago da Cloudflare e a Vercel; não espere a indisponibilidade para decidir.

## 10. Retorno para Vercel

O retorno não move nem restaura banco: Neon e R2 já são compartilhados.

1. interrompa novos testes no Worker e registre horário, erro e último fluxo concluído;
2. na Vercel, troque `BETTER_AUTH_URL` e `NEXT_PUBLIC_APP_URL` de volta para a URL Vercel;
3. mantenha `AUTH_TRUSTED_ORIGINS` com Worker e Vercel durante a transição;
4. faça novo deployment na Vercel usando o mesmo commit;
5. execute `npm run smoke:deployment -- https://<url-vercel>`;
6. repita login, abertura de foto existente, geração de orçamento e inicialização da PWA;
7. devolva a URL Vercel ao proprietário;
8. preserve Worker, R2, Neon e Base64 para investigação. Não exclua recursos no incidente.

O retorno está concluído somente depois que a Vercel passa os testes reais, não apenas quando o deployment informa sucesso.

## Registro de liberação

Preencha no momento da implantação:

| Evidência | Resultado |
| --- | --- |
| Commit implantado | |
| URL temporária Worker | |
| Testes / typecheck / builds | |
| `vinext check` | |
| Auditoria de dependências | |
| Fotos candidatas / migradas / falhas | |
| Smoke público Worker | |
| Checklist autenticado | |
| Leitura da mesma foto na Vercel | |
| Instalação PWA | |
| Observabilidade sem limite de CPU | |
| URL entregue ao proprietário | |

