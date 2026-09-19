export type Status =
  | "Agendada"
  | "Em execução"
  | "Aguardando aprovação"
  | "Concluída";

export type WorkOrder = {
  id: string;
  client: string;
  car: string;
  service: string;
  status: Status;
  value: number;
  date: string;
  mechanic: string;
};

export type Client = {
  id: number;
  name: string;
  phone: string;
  email: string;
  car: string;
  visits: number;
  total: number;
  lastVisit: string;
};

export type AppointmentStatus = "Confirmado" | "A confirmar" | "Em atendimento";

export type Appointment = {
  time: string;
  client: string;
  car: string;
  service: string;
  mechanic: string;
  status: AppointmentStatus;
};

export type WorkshopState = {
  orders: WorkOrder[];
  clients: Client[];
  appointments: Appointment[];
};

export type NewOrder = Pick<
  WorkOrder,
  "client" | "car" | "service" | "value" | "mechanic"
>;
export type NewClient = Pick<Client, "name" | "phone" | "email" | "car">;
export type NewAppointment = Pick<
  Appointment,
  "time" | "client" | "car" | "service" | "mechanic"
>;

export const WORKSHOP_STORAGE_KEY = "natinho-scooters:workshop:v1";
export const WORKSHOP_SCHEMA_VERSION = 1;

const seedOrders: WorkOrder[] = [
  {
    id: "OS-1048",
    client: "Mariana Souza",
    car: "Toyota Corolla 2021",
    service: "Revisão 40 mil km",
    status: "Em execução",
    value: 1240,
    date: "Hoje, 14:30",
    mechanic: "Rafael",
  },
  {
    id: "OS-1047",
    client: "Lucas Mendonça",
    car: "Honda Civic 2020",
    service: "Alinhamento e balanceamento",
    status: "Aguardando aprovação",
    value: 380,
    date: "Hoje, 15:15",
    mechanic: "Bruno",
  },
  {
    id: "OS-1043",
    client: "Carlos Henrique",
    car: "Jeep Renegade 2022",
    service: "Troca de óleo e filtros",
    status: "Agendada",
    value: 510,
    date: "Hoje, 16:00",
    mechanic: "Rafael",
  },
  {
    id: "OS-1042",
    client: "Ana Oliveira",
    car: "Volkswagen T-Cross 2023",
    service: "Revisão preventiva",
    status: "Concluída",
    value: 680,
    date: "Ontem",
    mechanic: "João",
  },
  {
    id: "OS-1041",
    client: "Renato Silva",
    car: "Chevrolet Onix 2021",
    service: "Diagnóstico eletrônico",
    status: "Concluída",
    value: 290,
    date: "Ontem",
    mechanic: "Bruno",
  },
];

const seedClients: Client[] = [
  {
    id: 1,
    name: "Mariana Souza",
    phone: "(11) 99999-1032",
    email: "mariana@email.com",
    car: "Toyota Corolla 2021",
    visits: 6,
    total: 5280,
    lastVisit: "Hoje",
  },
  {
    id: 2,
    name: "Lucas Mendonça",
    phone: "(11) 98888-7731",
    email: "lucas@email.com",
    car: "Honda Civic 2020",
    visits: 3,
    total: 1740,
    lastVisit: "12 set",
  },
  {
    id: 3,
    name: "Carlos Henrique",
    phone: "(11) 97777-4882",
    email: "carlos@email.com",
    car: "Jeep Renegade 2022",
    visits: 4,
    total: 2630,
    lastVisit: "29 ago",
  },
  {
    id: 4,
    name: "Ana Oliveira",
    phone: "(11) 96666-3920",
    email: "ana@email.com",
    car: "Volkswagen T-Cross 2023",
    visits: 8,
    total: 7190,
    lastVisit: "17 set",
  },
];

const seedAppointments: Appointment[] = [
  {
    time: "08:30",
    client: "Paulo Almeida",
    car: "Fiat Pulse 2024",
    service: "Diagnóstico",
    mechanic: "Bruno",
    status: "Confirmado",
  },
  {
    time: "10:00",
    client: "Ana Oliveira",
    car: "Volkswagen T-Cross 2023",
    service: "Revisão preventiva",
    mechanic: "João",
    status: "Em atendimento",
  },
  {
    time: "14:30",
    client: "Mariana Souza",
    car: "Toyota Corolla 2021",
    service: "Revisão 40 mil km",
    mechanic: "Rafael",
    status: "Em atendimento",
  },
  {
    time: "15:15",
    client: "Lucas Mendonça",
    car: "Honda Civic 2020",
    service: "Alinhamento e balanceamento",
    mechanic: "Bruno",
    status: "A confirmar",
  },
  {
    time: "16:00",
    client: "Carlos Henrique",
    car: "Jeep Renegade 2022",
    service: "Troca de óleo e filtros",
    mechanic: "Rafael",
    status: "Confirmado",
  },
];

export const initialWorkshopState: WorkshopState = {
  orders: seedOrders,
  clients: seedClients,
  appointments: seedAppointments,
};

export function cloneWorkshopState(
  state: WorkshopState = initialWorkshopState,
): WorkshopState {
  return {
    orders: state.orders.map((order) => ({ ...order })),
    clients: state.clients.map((client) => ({ ...client })),
    appointments: state.appointments.map((appointment) => ({ ...appointment })),
  };
}

function nextOrderId(orders: WorkOrder[]): string {
  const highest = orders.reduce((max, order) => {
    const suffix = Number(order.id.match(/(\d+)$/)?.[1] ?? 0);
    return Number.isFinite(suffix) ? Math.max(max, suffix) : max;
  }, 0);
  return `OS-${highest + 1}`;
}

export function addOrder(state: WorkshopState, input: NewOrder): WorkshopState {
  const order: WorkOrder = {
    ...input,
    id: nextOrderId(state.orders),
    status: "Agendada",
    date: "Hoje, 17:30",
  };
  return { ...state, orders: [order, ...state.orders] };
}

export function addClient(
  state: WorkshopState,
  input: NewClient,
): WorkshopState {
  const id =
    state.clients.reduce((max, client) => Math.max(max, client.id), 0) + 1;
  const client: Client = {
    ...input,
    id,
    visits: 0,
    total: 0,
    lastVisit: "Novo",
  };
  return { ...state, clients: [client, ...state.clients] };
}

export function addAppointment(
  state: WorkshopState,
  input: NewAppointment,
): WorkshopState {
  const appointment: Appointment = { ...input, status: "A confirmar" };
  return {
    ...state,
    appointments: [...state.appointments, appointment].sort((a, b) =>
      a.time.localeCompare(b.time),
    ),
  };
}

export function advanceOrderStatus(
  state: WorkshopState,
  id: string,
): WorkshopState {
  const nextStatus: Record<Status, Status> = {
    Agendada: "Em execução",
    "Em execução": "Concluída",
    "Aguardando aprovação": "Em execução",
    Concluída: "Concluída",
  };
  return {
    ...state,
    orders: state.orders.map((order) =>
      order.id === id ? { ...order, status: nextStatus[order.status] } : order,
    ),
  };
}

function isWorkshopState(value: unknown): value is WorkshopState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WorkshopState>;
  return (
    Array.isArray(candidate.orders) &&
    Array.isArray(candidate.clients) &&
    Array.isArray(candidate.appointments)
  );
}

export function serializeWorkshop(state: WorkshopState): string {
  return JSON.stringify({ version: WORKSHOP_SCHEMA_VERSION, state });
}

export function parseWorkshop(raw: string | null): WorkshopState {
  if (!raw) return cloneWorkshopState();
  try {
    const payload = JSON.parse(raw) as { version?: number; state?: unknown };
    if (
      payload.version !== WORKSHOP_SCHEMA_VERSION ||
      !isWorkshopState(payload.state)
    )
      return cloneWorkshopState();
    return cloneWorkshopState(payload.state);
  } catch {
    return cloneWorkshopState();
  }
}

function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function ordersToCsv(orders: WorkOrder[]): string {
  const header = [
    "Ordem",
    "Cliente",
    "Veículo",
    "Serviço",
    "Responsável",
    "Status",
    "Valor",
    "Data",
  ];
  const rows = orders.map((order) => [
    order.id,
    order.client,
    order.car,
    order.service,
    order.mechanic,
    order.status,
    order.value,
    order.date,
  ]);
  return [header, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\r\n");
}
