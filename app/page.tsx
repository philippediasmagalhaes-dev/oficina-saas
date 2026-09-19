"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useWorkshop } from "../hooks/useWorkshop";
import { downloadTextFile } from "../lib/download";
import {
  calculateOrderMetrics,
  formatAgendaDate,
  formatLongDate,
  ordersToCsv,
  serializeWorkshop,
  type Appointment,
  type Client,
  type Status,
  type WorkOrder,
} from "../lib/workshop";
const nav = [
  ["▦", "Visão geral"],
  ["⌁", "Ordens de serviço"],
  ["◷", "Agenda"],
  ["♧", "Clientes"],
  ["◔", "Relatórios"],
] as const;
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const statusClass = (status: string) =>
  status
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll("ç", "c")
    .replaceAll("ã", "a");
const Icon = ({ children }: { children: string }) => (
  <span className="icon" aria-hidden="true">
    {children}
  </span>
);

export default function Home() {
  const [section, setSection] = useState<
    (typeof nav)[number][1] | "Configurações"
  >("Visão geral");
  const {
    orders,
    clients,
    appointments,
    hydrated,
    createOrder,
    createClient,
    createAppointment,
    advanceOrder: updateOrderStatus,
  } = useWorkshop();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Status | "Todas">("Todas");
  const [modal, setModal] = useState<"order" | "client" | "appointment" | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  const [settingsTab, setSettingsTab] = useState("Empresa");
  const today = new Date();
  const longDate = formatLongDate(today);
  const agendaDate = formatAgendaDate(today);
  const filteredOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          (filter === "Todas" || o.status === filter) &&
          `${o.id} ${o.client} ${o.car} ${o.service}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [orders, filter, query],
  );
  const filteredClients = useMemo(
    () =>
      clients.filter((c) =>
        `${c.name} ${c.car} ${c.phone}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [clients, query],
  );
  const inform = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2800);
  };
  const saveOrder = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    createOrder({
      client: String(d.get("client")),
      car: String(d.get("car")),
      service: String(d.get("service")),
      value: Number(d.get("value")),
      mechanic: String(d.get("mechanic")),
    });
    setModal(null);
    inform("Ordem de serviço criada.");
  };
  const saveClient = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    createClient({
      name: String(d.get("name")),
      phone: String(d.get("phone")),
      email: String(d.get("email")),
      car: String(d.get("car")),
    });
    setModal(null);
    inform("Cliente adicionado à base.");
  };
  const saveAppointment = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    createAppointment({
      time: String(d.get("time")),
      client: String(d.get("client")),
      car: String(d.get("car")),
      service: String(d.get("service")),
      mechanic: String(d.get("mechanic")),
    });
    setModal(null);
    inform("Agendamento salvo.");
  };
  const advanceOrder = (id: string) => {
    updateOrderStatus(id);
    inform("Status da ordem atualizado.");
  };
  const exportOrders = () => {
    downloadTextFile(
      "ordens-natinho-scooters.csv",
      ordersToCsv(orders),
      "text/csv;charset=utf-8",
    );
    inform("Relatório CSV baixado.");
  };
  const exportBackup = () => {
    downloadTextFile(
      "backup-natinho-scooters.json",
      serializeWorkshop({ orders, clients, appointments }),
      "application/json;charset=utf-8",
    );
    inform("Backup local baixado.");
  };
  const title = section === "Visão geral" ? "Bom dia, Marcelo" : section;
  return (
    <main className="app" aria-busy={!hydrated}>
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Ir para visão geral">
          <img className="brand-logo" src="/logo.jpg" alt="Natinho Scooters" />
        </a>
        <div className="workshop">
          <b>NS</b>
          <span>
            <strong>Natinho Scooters</strong>
            <small>Plano Pro</small>
          </span>
          <button
            aria-label="Ver oficina ativa"
            onClick={() => inform("Natinho Scooters é a oficina ativa.")}
          >
            ⌄
          </button>
        </div>
        <nav>
          {nav.map(([icon, label]) => (
            <button
              key={label}
              className={section === label ? "active" : ""}
              onClick={() => {
                setSection(label);
                setQuery("");
              }}
            >
              <Icon>{icon}</Icon>
              <span>{label}</span>
              {label === "Ordens de serviço" && (
                <em>{orders.filter((o) => o.status !== "Concluída").length}</em>
              )}
            </button>
          ))}
        </nav>
        <div className="side-end">
          <button
            className={section === "Configurações" ? "active" : ""}
            onClick={() =>
              setSection("Configurações" as (typeof nav)[number][1])
            }
          >
            <Icon>⚙</Icon>
            <span>Configurações</span>
          </button>
          <div className="support">
            <i>?</i>
            <p>
              <b>Precisa de ajuda?</b>
              <small>Fale com nosso time</small>
            </p>
          </div>
        </div>
      </aside>
      <section className="main">
        <header>
          <div className="crumb">
            <span>Natinho Scooters</span>
            <b>/</b>
            <strong>{section}</strong>
          </div>
          <div className="header-actions">
            <span className="sync-status" role="status">
              {hydrated ? "Dados salvos neste dispositivo" : "Carregando dados"}
            </span>
            <button
              className="theme"
              onClick={exportBackup}
              aria-label="Baixar backup dos dados"
            >
              ⇩
            </button>
            <button
              className="bell"
              aria-label="Abrir notificações"
              onClick={() => inform("Nenhuma notificação nova.")}
            >
              ●<i />
            </button>
            <button
              className="profile"
              aria-label="Abrir perfil de Marcelo Costa"
              onClick={() => setSection("Configurações")}
            >
              MC
            </button>
          </div>
        </header>
        <div className="content">
          <section className="page-intro">
            <div>
              <p className="overline" suppressHydrationWarning>
                {longDate}
              </p>
              <h1>
                {title} {section === "Visão geral" && <span>✦</span>}
              </h1>
              <p>
                {section === "Visão geral"
                  ? "Sua operação está fluindo bem hoje."
                  : section === "Ordens de serviço"
                    ? "Acompanhe cada serviço da entrada à entrega."
                    : section === "Agenda"
                      ? "Organize a operação e reduza horários ociosos."
                      : section === "Clientes"
                        ? "Histórico e relacionamento em um só lugar."
                        : section === "Relatórios"
                          ? "Decisões melhores com os números da sua oficina."
                          : "Personalize sua operação e equipe."}
              </p>
            </div>
            {section !== "Configurações" && (
              <button
                className="primary"
                onClick={() =>
                  setModal(
                    section === "Clientes"
                      ? "client"
                      : section === "Agenda"
                        ? "appointment"
                        : "order",
                  )
                }
              >
                <Icon>+</Icon>
                {section === "Clientes"
                  ? "Novo cliente"
                  : section === "Agenda"
                    ? "Novo agendamento"
                    : "Nova ordem"}
              </button>
            )}
          </section>
          {section === "Visão geral" && (
            <Dashboard
              orders={orders}
              appointments={appointments}
              advanceOrder={advanceOrder}
              setSection={setSection}
            />
          )}
          {section === "Ordens de serviço" && (
            <Orders
              orders={filteredOrders}
              filter={filter}
              setFilter={setFilter}
              query={query}
              setQuery={setQuery}
              advanceOrder={advanceOrder}
            />
          )}
          {section === "Agenda" && (
            <Agenda
              appointments={appointments}
              date={agendaDate}
              onNew={() => setModal("appointment")}
            />
          )}
          {section === "Clientes" && (
            <Clients
              clients={filteredClients}
              query={query}
              setQuery={setQuery}
            />
          )}
          {section === "Relatórios" && (
            <Reports
              orders={orders}
              clients={clients}
              onExport={exportOrders}
            />
          )}
          {section === "Configurações" && (
            <Settings
              active={settingsTab}
              setActive={setSettingsTab}
              inform={inform}
            />
          )}
        </div>
      </section>
      <nav className="mobile-nav" aria-label="Navegação móvel">
        {nav.map(([icon, label]) => (
          <button
            key={label}
            className={section === label ? "active" : ""}
            onClick={() => {
              setSection(label);
              setQuery("");
            }}
          >
            <Icon>{icon}</Icon>
            <span>{label === "Ordens de serviço" ? "Ordens" : label}</span>
          </button>
        ))}
        <button
          className={section === "Configurações" ? "active" : ""}
          onClick={() => setSection("Configurações")}
        >
          <Icon>⚙</Icon>
          <span>Ajustes</span>
        </button>
      </nav>
      {modal && (
        <Modal
          title={
            modal === "order"
              ? "Nova ordem de serviço"
              : modal === "client"
                ? "Novo cliente"
                : "Novo agendamento"
          }
          onClose={() => setModal(null)}
        >
          {modal === "order" ? (
            <OrderForm onSubmit={saveOrder} />
          ) : modal === "client" ? (
            <ClientForm onSubmit={saveClient} />
          ) : (
            <AppointmentForm onSubmit={saveAppointment} />
          )}
        </Modal>
      )}
      {notice && (
        <div className="toast">
          <i>✓</i>
          <span>{notice}</span>
        </div>
      )}
    </main>
  );
}

function Metric({
  label,
  value,
  detail,
  trend,
  bars,
}: {
  label: string;
  value: string;
  detail: string;
  trend?: string;
  bars?: boolean;
}) {
  return (
    <article className="metric card">
      <div className="metric-label">
        <span>{label}</span>
        {trend && <b className="trend">↗ {trend}</b>}
      </div>
      <strong>{value}</strong>
      {bars ? (
        <div className="bars">
          {[38, 56, 42, 72, 58, 81, 67, 92].map((h, i) => (
            <i key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
      ) : (
        <div className="line-chart">
          <svg viewBox="0 0 300 48" preserveAspectRatio="none">
            <path d="M0 42 C27 36,30 32,50 35 S76 19,95 27 S122 35,145 20 S177 24,196 15 S235 29,260 12 S280 9,300 3" />
          </svg>
        </div>
      )}
      <small>{detail}</small>
    </article>
  );
}
function Dashboard({
  orders,
  appointments,
  advanceOrder,
  setSection,
}: {
  orders: WorkOrder[];
  appointments: Appointment[];
  advanceOrder: (id: string) => void;
  setSection: (s: (typeof nav)[number][1]) => void;
}) {
  const priorities = orders.filter((o) => o.status !== "Concluída").slice(0, 3);
  const metrics = calculateOrderMetrics(orders);
  const monthlyTarget = 60_000;
  const goalPercentage = Math.min(
    100,
    Math.round((metrics.revenue / monthlyTarget) * 100),
  );
  return (
    <>
      <section className="metrics">
        <Metric
          label="Faturamento do mês"
          value={money.format(metrics.revenue)}
          detail={`${metrics.completedOrders} serviços concluídos`}
        />
        <Metric
          label="Ordens em aberto"
          value={`${metrics.openOrders} serviços`}
          detail={`${orders.filter((order) => order.status === "Em execução").length} em execução · ${orders.filter((order) => order.status === "Aguardando aprovação").length} aguardando`}
          bars
        />
        <Metric
          label="Ticket médio"
          value={money.format(metrics.averageTicket)}
          detail="média dos serviços concluídos"
          bars
        />
      </section>
      <section className="card panel">
        <PanelTitle
          title="Prioridades de hoje"
          description="Acompanhe o que precisa da sua atenção."
          action="Ver todas as ordens"
          onClick={() => setSection("Ordens de serviço")}
        />
        <div className="order-list">
          {priorities.map((o) => (
            <OrderRow key={o.id} order={o} action={() => advanceOrder(o.id)} />
          ))}
        </div>
      </section>
      <section className="split">
        <article className="card panel">
          <PanelTitle
            title="Próximos horários"
            description="Agenda de hoje"
            action="Abrir agenda"
            onClick={() => setSection("Agenda")}
          />
          <div className="compact-list">
            {appointments.slice(0, 3).map((a) => (
              <div key={a.time} className="appointment">
                <time>{a.time}</time>
                <span>
                  <b>{a.client}</b>
                  <small>
                    {a.service} · {a.car}
                  </small>
                </span>
                <em className={statusClass(a.status)}>{a.status}</em>
              </div>
            ))}
          </div>
        </article>
        <article className="goal">
          <p className="overline">META DO MÊS</p>
          <h2>Quase lá.</h2>
          <p>
            Você já atingiu <b>{goalPercentage}%</b> da sua meta mensal.
          </p>
          <div className="goal-progress">
            <i style={{ width: `${goalPercentage}%` }} />
          </div>
          <div className="goal-values">
            <span>{money.format(metrics.revenue)}</span>
            <span>{money.format(monthlyTarget)}</span>
          </div>
          <button onClick={() => setSection("Relatórios")}>
            Ver desempenho <Icon>→</Icon>
          </button>
        </article>
      </section>
    </>
  );
}
function Orders({
  orders,
  filter,
  setFilter,
  query,
  setQuery,
  advanceOrder,
}: {
  orders: WorkOrder[];
  filter: Status | "Todas";
  setFilter: (f: Status | "Todas") => void;
  query: string;
  setQuery: (q: string) => void;
  advanceOrder: (id: string) => void;
}) {
  const statuses: (Status | "Todas")[] = [
    "Todas",
    "Agendada",
    "Em execução",
    "Aguardando aprovação",
    "Concluída",
  ];
  return (
    <section className="card table-panel">
      <div className="toolbar">
        <label className="search">
          <Icon>⌕</Icon>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por cliente, veículo ou OS"
            aria-label="Buscar ordens de serviço"
          />
        </label>
      </div>
      <div className="filter-tabs">
        {statuses.map((s) => (
          <button
            className={filter === s ? "selected" : ""}
            key={s}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="desktop-table">
        <div className="table-head">
          <span>ORDEM</span>
          <span>CLIENTE E VEÍCULO</span>
          <span>SERVIÇO</span>
          <span>RESPONSÁVEL</span>
          <span>STATUS</span>
          <span>VALOR</span>
          <span />
        </div>
        {orders.map((o) => (
          <OrderRow
            key={o.id}
            order={o}
            action={() => advanceOrder(o.id)}
            detailed
          />
        ))}
      </div>
      {orders.length === 0 && (
        <Empty
          title="Nenhuma ordem encontrada"
          text="Ajuste a busca ou crie uma nova ordem de serviço."
        />
      )}
    </section>
  );
}
function Agenda({
  appointments,
  date,
  onNew,
}: {
  appointments: Appointment[];
  date: { date: string; weekday: string };
  onNew: () => void;
}) {
  return (
    <>
      <section className="calendar-nav card">
        <button
          aria-label="Dia anterior"
          disabled
          title="Disponível com a agenda compartilhada"
        >
          ‹
        </button>
        <div>
          <b suppressHydrationWarning>Hoje, {date.date}</b>
          <span suppressHydrationWarning>{date.weekday}</span>
        </div>
        <button disabled>Hoje</button>
        <button
          aria-label="Próximo dia"
          disabled
          title="Disponível com a agenda compartilhada"
        >
          ›
        </button>
      </section>
      <section className="agenda">
        <div className="agenda-hours">
          {[
            "08:00",
            "09:00",
            "10:00",
            "11:00",
            "13:00",
            "14:00",
            "15:00",
            "16:00",
            "17:00",
          ].map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        <div className="agenda-events">
          {appointments.map((a) => (
            <article
              key={`${a.time}${a.client}`}
              className={`agenda-event ${statusClass(a.status)}`}
            >
              <time>{a.time}</time>
              <div>
                <b>{a.client}</b>
                <span>{a.car}</span>
                <small>
                  {a.service} · {a.mechanic}
                </small>
              </div>
              <em>{a.status}</em>
            </article>
          ))}
          <button className="empty-slot" onClick={onNew}>
            + Horário disponível
          </button>
        </div>
      </section>
      <section className="card panel agenda-summary">
        <PanelTitle
          title="Resumo do dia"
          description="Visão rápida da agenda de hoje"
        />
        <div>
          <b>5</b>
          <span>agendamentos</span>
          <b>3</b>
          <span>confirmados</span>
          <b>1</b>
          <span>aguardando confirmação</span>
        </div>
      </section>
    </>
  );
}
function Clients({
  clients,
  query,
  setQuery,
}: {
  clients: Client[];
  query: string;
  setQuery: (q: string) => void;
}) {
  return (
    <section className="card table-panel">
      <div className="toolbar">
        <label className="search">
          <Icon>⌕</Icon>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente, telefone ou veículo"
            aria-label="Buscar clientes"
          />
        </label>
      </div>
      <div className="client-grid">
        {clients.map((c) => (
          <article key={c.id} className="client-card">
            <div className="client-head">
              <i>
                {c.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)}
              </i>
            </div>
            <h3>{c.name}</h3>
            <p>{c.car}</p>
            <div className="client-info">
              <span>⌕ {c.phone}</span>
              <span>✉ {c.email}</span>
            </div>
            <div className="client-stats">
              <span>
                <b>{c.visits}</b> visitas
              </span>
              <span>
                <b>{money.format(c.total)}</b> em serviços
              </span>
            </div>
            <footer>
              <small>Última visita: {c.lastVisit}</small>
              <small>Histórico local</small>
            </footer>
          </article>
        ))}
      </div>
      {clients.length === 0 && (
        <Empty
          title="Nenhum cliente encontrado"
          text="Cadastre um cliente para iniciar seu relacionamento."
        />
      )}
    </section>
  );
}
function Reports({
  orders,
  clients,
  onExport,
}: {
  orders: WorkOrder[];
  clients: Client[];
  onExport: () => void;
}) {
  const metrics = calculateOrderMetrics(orders);
  const recurringClients = clients.filter((client) => client.visits > 1).length;
  const recurringRate = clients.length
    ? Math.round((recurringClients / clients.length) * 100)
    : 0;
  return (
    <>
      <section className="metrics report-metrics">
        <Metric
          label="Receita realizada"
          value={money.format(metrics.revenue)}
          detail="valor dos serviços concluídos"
        />
        <Metric
          label="Serviços concluídos"
          value={`${metrics.completedOrders}`}
          detail="no mês atual"
          bars
        />
        <Metric
          label="Clientes recorrentes"
          value={`${recurringRate}%`}
          detail={`${clients.length} clientes ativos`}
          bars
        />
      </section>
      <section className="split reports-grid">
        <article className="card panel">
          <PanelTitle
            title="Receita por serviço"
            description="Distribuição no período"
          />
          <div className="service-chart">
            {[
              ["Revisões", 82, "R$ 18.240"],
              ["Manutenção", 67, "R$ 14.800"],
              ["Pneus e rodas", 48, "R$ 10.240"],
              ["Diagnóstico", 28, "R$ 4.960"],
            ].map(([n, v, t]) => (
              <div key={String(n)}>
                <span>{n}</span>
                <i>
                  <b style={{ width: `${v}%` }} />
                </i>
                <strong>{t}</strong>
              </div>
            ))}
          </div>
        </article>
        <article className="card panel">
          <PanelTitle
            title="Indicadores da operação"
            description="Saúde da oficina"
          />
          <div className="indicators">
            {[
              ["Taxa de aprovação", "78%"],
              ["Ocupação da agenda", "84%"],
              ["Serviços no prazo", "92%"],
            ].map(([n, v]) => (
              <p key={n}>
                <span>{n}</span>
                <b>{v}</b>
                <i>
                  <em style={{ width: v }} />
                </i>
              </p>
            ))}
          </div>
        </article>
      </section>
      <section className="card panel">
        <PanelTitle
          title="Últimos recebimentos"
          description="Acompanhe o fluxo financeiro"
          action="Exportar CSV"
          onClick={onExport}
        />
        <div className="receipts">
          {orders
            .filter((o) => o.status === "Concluída")
            .map((o) => (
              <p key={o.id}>
                <i>✓</i>
                <span>
                  <b>{o.client}</b>
                  <small>
                    {o.id} · {o.service}
                  </small>
                </span>
                <strong>{money.format(o.value)}</strong>
                <em>Recebido</em>
              </p>
            ))}
        </div>
      </section>
    </>
  );
}
function Settings({
  active,
  setActive,
  inform,
}: {
  active: string;
  setActive: (t: string) => void;
  inform: (n: string) => void;
}) {
  const tabs = [
    "Empresa",
    "Equipe",
    "Serviços",
    "Notificações",
    "Plano e cobrança",
  ];
  return (
    <section className="settings">
      <aside className="card settings-menu">
        {tabs.map((t) => (
          <button
            onClick={() => setActive(t)}
            className={active === t ? "selected" : ""}
            key={t}
          >
            {t}
          </button>
        ))}
      </aside>
      <article className="card settings-body">
        {active === "Empresa" && (
          <>
            <div>
              <h2>Dados da empresa</h2>
              <p>
                Essas informações aparecem em comunicações e documentos da
                oficina.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                inform("Dados da empresa salvos.");
              }}
            >
              <FormField
                label="Nome da oficina"
                name="business"
                defaultValue="Natinho Scooters"
              />
              <div className="form-row">
                <FormField
                  label="CNPJ"
                  name="document"
                  defaultValue="12.345.678/0001-90"
                />
                <FormField
                  label="Telefone"
                  name="phone"
                  defaultValue="(11) 3333-1212"
                />
              </div>
              <FormField
                label="E-mail para contato"
                name="email"
                defaultValue="contato@natinho.com.br"
                type="email"
              />
              <FormField
                label="Endereço"
                name="address"
                defaultValue="Av. Paulista, 1000 — São Paulo, SP"
              />
              <button className="primary">Salvar alterações</button>
            </form>
          </>
        )}
        {active === "Equipe" && (
          <>
            <div>
              <h2>Equipe</h2>
              <p>Gerencie quem pode acessar sua operação.</p>
            </div>
            <div className="team-list">
              {[
                ["MC", "Marcelo Costa", "Administrador", "#6b927e"],
                ["RS", "Rafael Silva", "Mecânico", "#d5906e"],
                ["BA", "Bruno Alves", "Mecânico", "#7087bd"],
                ["JS", "João Santos", "Atendimento", "#a584bd"],
              ].map(([ini, n, r, color]) => (
                <p key={n}>
                  <i style={{ background: color }}>{ini}</i>
                  <span>
                    <b>{n}</b>
                    <small>{r}</small>
                  </span>
                  <button onClick={() => inform(`Convite enviado para ${n}.`)}>
                    Gerenciar
                  </button>
                </p>
              ))}
            </div>
            <button
              className="outline"
              onClick={() => inform("Convite para membro preparado.")}
            >
              + Convidar membro
            </button>
          </>
        )}
        {active === "Serviços" && (
          <>
            <div>
              <h2>Catálogo de serviços</h2>
              <p>Padronize preços e duração dos seus atendimentos.</p>
            </div>
            <div className="service-list">
              {[
                ["Troca de óleo e filtros", "R$ 250", "1h"],
                ["Alinhamento e balanceamento", "R$ 180", "50 min"],
                ["Revisão preventiva", "R$ 680", "3h"],
                ["Diagnóstico eletrônico", "R$ 160", "45 min"],
              ].map(([n, p, d]) => (
                <p key={n}>
                  <span>
                    <b>{n}</b>
                    <small>{d}</small>
                  </span>
                  <strong>{p}</strong>
                  <button>Editar</button>
                </p>
              ))}
            </div>
            <button
              className="outline"
              onClick={() => inform("Novo serviço pronto para cadastro.")}
            >
              + Adicionar serviço
            </button>
          </>
        )}
        {active === "Notificações" && (
          <>
            <div>
              <h2>Notificações</h2>
              <p>Escolha como sua equipe recebe atualizações importantes.</p>
            </div>
            <div className="toggles">
              {[
                "Novas ordens de serviço",
                "Aprovações de orçamento",
                "Lembretes de agenda",
                "Resumo diário por e-mail",
              ].map((l, i) => (
                <label key={l}>
                  <span>
                    <b>{l}</b>
                    <small>Notificar administradores da oficina</small>
                  </span>
                  <input type="checkbox" defaultChecked={i < 3} />
                  <i />
                </label>
              ))}
            </div>
          </>
        )}
        {active === "Plano e cobrança" && (
          <>
            <div>
              <h2>Plano Pro</h2>
              <p>Seu plano atual oferece acesso completo à operação.</p>
            </div>
            <div className="plan-card">
              <span>Plano atual</span>
              <h3>
                Pro <b>R$ 149/mês</b>
              </h3>
              <p>Equipe ilimitada, relatórios e atendimento prioritário.</p>
              <button
                className="outline"
                onClick={() =>
                  inform("Portal de cobrança disponível na produção.")
                }
              >
                Gerenciar assinatura
              </button>
            </div>
          </>
        )}
      </article>
    </section>
  );
}
function PanelTitle({
  title,
  description,
  action,
  onClick,
}: {
  title: string;
  description: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="panel-title">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action && (
        <button onClick={onClick}>
          {action} <Icon>→</Icon>
        </button>
      )}
    </div>
  );
}
function OrderRow({
  order,
  action,
  detailed = false,
}: {
  order: WorkOrder;
  action: () => void;
  detailed?: boolean;
}) {
  return (
    <article className={`order-row ${detailed ? "detailed" : ""}`}>
      <div className="order-mark">⌁</div>
      <div className="order-client">
        <span className="order-id">{order.id}</span>
        <b>{order.client}</b>
        <small>{order.car}</small>
      </div>
      <div className="order-service">
        <b>{order.service}</b>
        <small>{order.date}</small>
      </div>
      {detailed && <span className="mechanic">{order.mechanic}</span>}
      <em className={statusClass(order.status)}>{order.status}</em>
      {detailed && (
        <strong className="order-value">{money.format(order.value)}</strong>
      )}
      <button className="row-action" onClick={action}>
        {order.status === "Concluída" ? "Ver OS" : "Atualizar"}
      </button>
    </article>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <i>⌕</i>
      <b>{title}</b>
      <p>{text}</p>
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p className="overline">NATINHO SCOOTERS</p>
            <h2>{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar janela">
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function FormField({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required
      />
    </label>
  );
}
function OrderForm({
  onSubmit,
}: {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="modal-form">
      <FormField
        label="Nome do cliente"
        name="client"
        placeholder="Ex.: Camila Rodrigues"
      />
      <FormField
        label="Veículo"
        name="car"
        placeholder="Ex.: Nissan Kicks 2023"
      />
      <FormField
        label="Serviço"
        name="service"
        placeholder="Ex.: Revisão preventiva"
      />
      <div className="form-row">
        <FormField
          label="Valor estimado"
          name="value"
          type="number"
          placeholder="0"
        />
        <label className="field">
          <span>Responsável</span>
          <select name="mechanic" defaultValue="Rafael">
            <option>Rafael</option>
            <option>Bruno</option>
            <option>João</option>
          </select>
        </label>
      </div>
      <button className="primary">Criar ordem de serviço</button>
    </form>
  );
}
function ClientForm({
  onSubmit,
}: {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="modal-form">
      <FormField
        label="Nome completo"
        name="name"
        placeholder="Ex.: Camila Rodrigues"
      />
      <div className="form-row">
        <FormField
          label="Telefone"
          name="phone"
          placeholder="(11) 99999-9999"
        />
        <FormField
          label="E-mail"
          name="email"
          type="email"
          placeholder="cliente@email.com"
        />
      </div>
      <FormField
        label="Veículo"
        name="car"
        placeholder="Ex.: Nissan Kicks 2023"
      />
      <button className="primary">Adicionar cliente</button>
    </form>
  );
}
function AppointmentForm({
  onSubmit,
}: {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="modal-form">
      <div className="form-row">
        <FormField
          label="Horário"
          name="time"
          type="time"
          defaultValue="17:30"
        />
        <label className="field">
          <span>Responsável</span>
          <select name="mechanic" defaultValue="Rafael">
            <option>Rafael</option>
            <option>Bruno</option>
            <option>João</option>
          </select>
        </label>
      </div>
      <FormField
        label="Nome do cliente"
        name="client"
        placeholder="Ex.: Camila Rodrigues"
      />
      <FormField
        label="Veículo"
        name="car"
        placeholder="Ex.: Nissan Kicks 2023"
      />
      <FormField
        label="Serviço"
        name="service"
        placeholder="Ex.: Revisão preventiva"
      />
      <button className="primary">Salvar agendamento</button>
    </form>
  );
}
