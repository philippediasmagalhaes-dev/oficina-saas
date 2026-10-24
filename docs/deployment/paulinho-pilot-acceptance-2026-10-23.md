# Aceite do piloto Paulinho Autocar — 23/10/2026

## Resultado

O escopo interno aprovado para o piloto está implementado. A oficina pode operar sem depender das integrações opcionais: consulta de placa aceita preenchimento manual, WhatsApp mantém o link pelo número atual e o financeiro exporta CSV sem exigir acesso direto ao Business Fin.

## Matriz de requisitos

| Requisito aprovado | Situação no piloto |
| --- | --- |
| Acesso exclusivo do proprietário | Implementado com Better Auth; colaboradores não possuem login |
| Clientes e consentimento de WhatsApp | Cadastro, edição, endereço, documento, consentimento e opt-out implementados |
| Veículos | Cadastro e edição genéricos, histórico por veículo e busca assistida por placa implementados |
| Ordem de serviço numerada | Numeração sequencial por oficina, detalhes e histórico de status implementados |
| Diagnóstico e orçamento digital | Diagnóstico, itens, versões, link público, aprovação e recusa implementados |
| Aprovação sem internet pelo cliente | Registro presencial de aprovação ou recusa implementado pelo proprietário |
| Vistoria, acessórios, danos e fotos | Checklist, mapa de danos, observações e fotos privadas implementados |
| Status do serviço e aviso de veículo pronto | Histórico auditável e envio oficial quando configurado, com link manual como alternativa |
| Impressão A4 | OS completa com identidade, cliente, veículo, vistoria, itens, pagamentos, termos e assinaturas |
| Próxima manutenção e retenção | Previsão automática conforme o serviço e painel de clientes a retornar implementados |
| Lembretes automáticos por WhatsApp | Fila idempotente, consentimento, horários, bloqueio, cooldown, webhook e agendamento diário implementados; ativação depende das credenciais Meta e do vínculo `WHATSAPP_WORKSHOP_ID` |
| Preservar o número atual do WhatsApp | Implementado por configuração compatível com Meta; o modo manual continua usando o número atual |
| Colaboradores sem login | Cadastro do colaborador e modelos mensal, por serviço, percentual ou híbrido implementados |
| Vários colaboradores por serviço | Participação configurável, limitada a 100%, com comissão somente sobre mão de obra |
| Estoque simples | Entradas, ajustes, reserva na aprovação, consumo no início, liberação e histórico implementados |
| Taxa de cartão | Regras por meio/bandeira/parcelas e ajuste manual no fechamento implementados |
| Reserva de imposto | Percentual padrão e ajuste por OS, ambos registrados no fechamento financeiro |
| Financeiro completo do piloto | Pagamentos divididos, parcelas, caixa/competência, receber/pagar, baixas/estornos auditáveis, filtros e totais implementados |
| Valores mensais recorrentes | Geração idempotente de ocorrências mensais implementada |
| Integração com Business Fin | Exportação CSV UTF-8, identificadores estáveis e histórico antirrepetição implementados |
| Dashboard do mês corrente | Serviços, OS abertas, veículos prontos, receita líquida e recebíveis do mês implementados |
| Interface Paulinho Autocar | Fundo cinza-claro da marca, preto, vermelho e branco; referências antigas a motos/Natinho removidas |
| Hospedagem de baixo custo | Cloudflare Workers + R2 privado + Neon, com Vercel preservada como retorno |
| Aplicativo instalável | PWA com manifesto, ícones e service worker implementada |

## Dependências externas para liberar 100% das automações

Estas pendências não bloqueiam o uso diário do piloto:

1. **Dados oficiais da oficina:** conferir razão/nome, documento, endereço, telefone, e-mail, garantia e termos impressos em **Configurações**.
2. **Financeiro:** validar com o contador o percentual de reserva de imposto; cadastrar taxas reais das máquinas de cartão e saldos/valores dos colaboradores.
3. **Consulta de placa:** contratar ou ativar um provedor, cadastrar URL e token e fazer uma consulta real. Até lá, o cadastro manual permanece disponível.
4. **WhatsApp oficial:** concluir o cadastro da Meta, manter o número atual em coexistência quando elegível, cadastrar credenciais, aprovar os templates de manutenção e veículo pronto e registrar o webhook. Até lá, usar o botão de envio manual pelo WhatsApp.
5. **Business Fin:** obter um arquivo-modelo aceito pelo cliente e comparar os nomes/ordem das colunas antes da primeira importação. A integração direta por API continua fora deste piloto.
6. **Validação operacional:** executar com o proprietário uma OS real completa, da entrada do veículo ao fechamento, impressão e retorno previsto.

## Fora do piloto aprovado

Login de funcionários, agenda, emissão fiscal, conciliação bancária automática, compras/fornecedores avançados, integração direta com API do Business Fin e cobrança automática da assinatura SaaS ficam para fases posteriores.

## Evidência da liberação — 24/10/2026

- Código implantado: `4f15719` (`codex/cloudflare-pilot`).
- Cloudflare Worker: versão `f1e27469-0804-4863-8c58-a0d426ab1a15`.
- Neon: migração `0007_release_hardening` aplicada e estrutura confirmada.
- Testes: 156 aprovados; 1 integração destrutiva de banco ignorada sem `TEST_DATABASE_URL`.
- Build: Next.js e Cloudflare concluídos; `vinext check` com 100% de compatibilidade.
- Segurança de dependências: 0 vulnerabilidades de produção encontradas.
- Smoke público: 22 de 22 verificações aprovadas em `https://oficina-saas.contato-ad4.workers.dev`.
