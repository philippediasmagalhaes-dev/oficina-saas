# Oficina CRM

SaaS owner-only para oficinas acompanharem clientes, veículos, serviços concluídos, previsões de retorno, campanhas assistidas por WhatsApp e estoque simples. Construído com Next.js 16, React 19, Neon Postgres, Better Auth e Drizzle.

## Escopo do piloto Paulinho Autocar

- acesso exclusivo do proprietário, sem login de colaboradores;
- clientes completos, consentimento/opt-out de WhatsApp e veículos vinculados;
- consulta assistida por placa, sempre com cadastro manual disponível;
- OS sequencial com vistoria, mapa de danos, diagnóstico, fotos, orçamento digital versionado, aprovação e histórico de status;
- catálogo de serviços, peças, vários colaboradores por mão de obra e remuneração fixa, percentual ou híbrida;
- estoque simples com reserva na aprovação, consumo no início, liberação no cancelamento e trilha de movimentos;
- pagamento dividido, parcelas, taxa de cartão, reserva de imposto e fechamento financeiro imutável;
- contas a receber/pagar, regime de caixa ou competência, filtros e exportação CSV para Business Fin;
- impressão A4 completa com a identidade da oficina, sem credenciais de Wi-Fi;
- lembretes de manutenção por WhatsApp oficial quando configurado, além do envio manual pelo número atual;
- painel operacional limitado ao mês corrente e financeiro com períodos independentes;
- isolamento por `workshop_id` derivado da sessão no servidor.

Continuam fora desta fase: login de funcionários, agenda, emissão fiscal, conciliação bancária, compras/fornecedores avançados e cobrança automática da assinatura SaaS.

## Rodar localmente

Requisitos: Node.js 22+ e um banco Neon Postgres.

```bash
npm install
copy .env.example .env.local
npm run db:migrate
npm run db:seed-owner
npm run dev
```

Preencha em `.env.local`:

- `DATABASE_URL`: conexão pooled do Neon;
- `BETTER_AUTH_URL`: `http://localhost:3000` localmente;
- `BETTER_AUTH_SECRET`: segredo aleatório de ao menos 32 caracteres;
- `OWNER_EMAIL`, `OWNER_PASSWORD` e `OWNER_NAME`: usados apenas pelo comando de seed.

O cadastro público está desativado. `db:seed-owner` é idempotente e cria somente o primeiro acesso convidado.

## Banco e migrações

```bash
npm run db:generate
npm run db:migrate
```

O schema inclui autenticação, catálogo de serviços e os módulos de negócio do piloto. Valores monetários usam centavos inteiros; estoque nunca pode ficar negativo. Ao consumir peças, o serviço, o saldo e os movimentos são gravados na mesma transação.

### Migrar fotos antigas para o R2

Mantenha `DATABASE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` e `R2_BUCKET_NAME` disponíveis somente no ambiente seguro em que o comando será executado. Siga esta ordem para preservar o retorno imediato à versão da Vercel:

1. aplique a alteração do banco com `npm run db:migrate`;
2. simule a migração com `npm run db:migrate-photos:r2 -- --dry-run`;
3. execute `npm run db:migrate-photos:r2`;
4. repita `npm run db:migrate-photos:r2 -- --dry-run` e confirme `candidate=0`;
5. abra uma amostra das fotos antigas tanto no Worker quanto na versão da Vercel;
6. mantenha o conteúdo Base64 no banco até uma versão futura de limpeza, aprovada separadamente.

O processo usa lotes pequenos, pode ser repetido com segurança e não apaga a cópia antiga das imagens.

## Verificação

```bash
npm test
npm run typecheck
npm run build
npm audit
```

O teste de integração com banco é opt-in. Defina `TEST_DATABASE_URL` para executá-lo; sem essa variável ele aparece como ignorado de forma explícita.

## Deploy na Vercel (retorno)

1. Conecte o repositório ao projeto Vercel existente.
2. Crie ou conecte um projeto Neon e copie a conexão pooled para `DATABASE_URL`.
3. Adicione em Production:
   - `DATABASE_URL`;
   - `BETTER_AUTH_URL=https://oficina-saas-green.vercel.app`;
   - `BETTER_AUTH_SECRET` com 32+ caracteres aleatórios;
   - `NEXT_PUBLIC_APP_URL=https://oficina-saas-green.vercel.app`.
4. Aplique `npm run db:migrate` usando a URL de produção.
5. Crie o proprietário uma vez com `OWNER_EMAIL`, `OWNER_PASSWORD` e `OWNER_NAME` disponíveis somente durante `npm run db:seed-owner`; depois remova essas três variáveis do ambiente.
6. Faça o deploy do mesmo commit verificado localmente.

Sem as três variáveis obrigatórias, o build continua seguro e a aplicação mostra apenas “Configuração pendente”, sem expor valores secretos.

## Deploy do piloto na Cloudflare

O alvo principal do piloto usa Cloudflare Workers com fotos em bucket R2 privado, Neon compartilhado e Vercel preservada como retorno. O procedimento completo, incluindo migração sem perda, variáveis, teste da URL temporária, monitoramento de cota e retorno, está em [`docs/deployment/cloudflare-pilot.md`](docs/deployment/cloudflare-pilot.md).

O smoke público pode ser repetido em qualquer um dos destinos sem alterar dados:

```bash
npm run smoke:deployment -- https://endereco-do-deployment
```

O Worker executa diariamente às 09:00 de Brasília o endpoint protegido da fila de lembretes. Sem as credenciais e o template aprovado da Meta, nenhuma mensagem automática é enviada e os links manuais continuam disponíveis.

## Integrações opcionais

- Consulta de placa: `PLATE_LOOKUP_PROVIDER`, `PLATE_LOOKUP_API_URL` e `PLATE_LOOKUP_API_TOKEN`.
- WhatsApp oficial: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_REMINDER_TEMPLATE_NAME`, `WHATSAPP_READY_TEMPLATE_NAME`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` e `CRON_SECRET`.
- Fotos: credenciais privadas do bucket R2 já descritas no runbook.

Se as integrações externas não estiverem configuradas, placa e WhatsApp permanecem operacionais no modo manual.

## Estrutura

- `app/`: módulos do proprietário, rotas de autenticação, impressão e integrações;
- `components/`: shell responsivo, formulários e estados vazios;
- `db/`: schema, cliente, migrações e seed;
- `domain/`: regras puras de previsão, estoque, dinheiro e WhatsApp;
- `server/`: contexto owner-only, serviços, queries e repositório Drizzle;
- `docs/superpowers/`: especificação e plano verificável desta revisão.
