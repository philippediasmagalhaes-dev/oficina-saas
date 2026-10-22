# Oficina CRM

SaaS owner-only para oficinas acompanharem clientes, veículos, serviços concluídos, previsões de retorno, campanhas assistidas por WhatsApp e estoque simples. Construído com Next.js 16, React 19, Neon Postgres, Better Auth e Drizzle.

## Escopo do MVP

- acesso exclusivo do proprietário por convite;
- clientes com consentimento de WhatsApp e veículos vinculados;
- catálogo de serviços com preço e retorno sugeridos, associado ao histórico de cada cliente;
- painel financeiro de receita registrada, ticket médio, evolução mensal e ranking de serviços;
- retenção determinística: retorno próximo, atrasado ou cliente inativo;
- mensagem pronta e abertura manual do WhatsApp — nenhum envio automático;
- estoque com entrada, ajuste, mínimo e consumo transacional no serviço;
- isolamento por `workshop_id` derivado da sessão no servidor;
- sem funcionários, agenda, contas a pagar/receber, cobrança ou cadastro público nesta fase.

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

## Deploy na Vercel

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

## Estrutura

- `app/`: sete módulos do proprietário e rotas de autenticação;
- `components/`: shell responsivo, formulários e estados vazios;
- `db/`: schema, cliente, migrações e seed;
- `domain/`: regras puras de previsão, estoque, dinheiro e WhatsApp;
- `server/`: contexto owner-only, serviços, queries e repositório Drizzle;
- `docs/superpowers/`: especificação e plano verificável desta revisão.
