# Natinho Scooters

SaaS de gestão operacional para oficinas, construído com Next.js 16, React 19 e TypeScript. O MVP reúne visão geral, ordens de serviço, agenda, clientes, relatórios e configurações em uma interface responsiva com a identidade preto, amarelo e branco da Natinho Scooters.

## Estado do MVP

| Requisito                          | Estado                       | Evidência                                                  |
| ---------------------------------- | ---------------------------- | ---------------------------------------------------------- |
| Build compatível com Vercel        | Atendido                     | `npm run build` gera a rota estática `/`                   |
| Dependências de produção seguras   | Atendido                     | `npm audit --omit=dev` sem vulnerabilidades                |
| Ordens, clientes e agenda          | Atendido para piloto         | Criação, busca, filtros, status e persistência local       |
| Persistência entre recargas        | Atendido para um dispositivo | Estado versionado no `localStorage`                        |
| Exportação e portabilidade         | Atendido                     | CSV de ordens e backup JSON                                |
| Datas e calendário                 | Atendido                     | Datas atuais em `pt-BR`; agenda diária                     |
| Acessibilidade essencial           | Atendido                     | Nomes em controles, Escape em modais e movimento reduzido  |
| Testes automatizados               | Atendido                     | Vitest cobre domínio, armazenamento, CSV, datas e download |
| Identidade visual                  | Atendido                     | Logo Natinho Scooters e paleta preto/amarelo/branco        |
| Banco compartilhado e multiusuário | Pendente de configuração     | Requer PostgreSQL e migração do armazenamento local        |
| Login e permissões                 | Pendente de configuração     | Requer provedor de autenticação e papéis                   |
| Cobrança do SaaS                   | Pendente de configuração     | Requer Stripe e webhooks                                   |
| Mensagens e arquivos               | Pendente de configuração     | Requer e-mail, WhatsApp/SMS e armazenamento de objetos     |

## Rodar localmente

Requisitos: Node.js `22.12+` e npm.

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`. Os dados do piloto ficam no navegador sob a chave `natinho-scooters:workshop:v1`. Use o botão de download no cabeçalho para gerar um backup antes de limpar dados do navegador.

## Verificação

```bash
npm test
npm run typecheck
npm run build
npm audit --omit=dev
```

## Deploy na Vercel

1. Importe o repositório `philippediasmagalhaes-dev/oficina-saas` na Vercel.
2. Use o preset Next.js e mantenha a região `gru1`, definida em `vercel.json`.
3. Para o MVP local-only, nenhuma variável é obrigatória.
4. Para produção multiusuário, copie `.env.example` para o painel de variáveis da Vercel e preencha somente os provedores efetivamente adotados.
5. Proteja Preview e Production com ambientes separados e nunca versiona valores reais de `.env`.

## Limites e próximos passos de produção

O estado atual é adequado para demonstração e piloto em um único navegador. Antes de cadastrar clientes reais ou operar com mais de uma pessoa, configure:

- PostgreSQL com migrações, isolamento por oficina e backups automáticos;
- autenticação com papéis de administrador, atendimento e mecânico;
- criptografia, política de retenção, consentimento e atendimento à LGPD;
- Vercel Blob/S3 para fotos, laudos e documentos das ordens;
- Resend e WhatsApp/SMS para confirmação e lembretes;
- Stripe para planos, checkout, portal e webhooks idempotentes;
- Sentry, logs estruturados, alertas e monitoramento de disponibilidade;
- domínio próprio, DNS, remetente de e-mail e páginas legais;
- testes end-to-end dos fluxos de criação, aprovação, conclusão e recebimento.

Os nomes de variáveis necessários estão em `.env.example`; o arquivo contém apenas exemplos e não deve receber credenciais reais.

## Estrutura principal

- `app/page.tsx`: interface e fluxos do MVP.
- `lib/workshop.ts`: modelo, regras, serialização, datas e CSV.
- `hooks/useWorkshop.ts`: hidratação e persistência no navegador.
- `lib/*.test.ts` e `hooks/*.test.ts`: testes automatizados.
- `docs/superpowers/specs/`: auditoria e desenho da revisão.
- `docs/superpowers/plans/`: plano de implementação verificável.
