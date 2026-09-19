import { describe, expect, it } from "vitest";
import {
  addAppointment,
  addOrder,
  advanceOrderStatus,
  formatAgendaDate,
  formatLongDate,
  initialWorkshopState,
  ordersToCsv,
  parseWorkshop,
  serializeWorkshop,
} from "./workshop";

describe("workshop domain", () => {
  it("falls back to a fresh seed state for malformed persisted data", () => {
    const restored = parseWorkshop("{not-json");

    expect(restored).toEqual(initialWorkshopState);
    expect(restored).not.toBe(initialWorkshopState);
  });

  it("falls back when the persisted schema version is incompatible", () => {
    const restored = parseWorkshop(JSON.stringify({ version: 99, state: {} }));

    expect(restored).toEqual(initialWorkshopState);
  });

  it("moves an order forward and never reopens a completed order", () => {
    const scheduled = {
      ...initialWorkshopState.orders[2],
      status: "Agendada" as const,
    };
    const running = advanceOrderStatus(
      { ...initialWorkshopState, orders: [scheduled] },
      scheduled.id,
    );
    const completed = advanceOrderStatus(running, scheduled.id);
    const unchanged = advanceOrderStatus(completed, scheduled.id);

    expect(running.orders[0].status).toBe("Em execução");
    expect(completed.orders[0].status).toBe("Concluída");
    expect(unchanged.orders[0].status).toBe("Concluída");
  });

  it("generates the next order id from the highest existing suffix", () => {
    const state = {
      ...initialWorkshopState,
      orders: [
        { ...initialWorkshopState.orders[0], id: "OS-1002" },
        { ...initialWorkshopState.orders[1], id: "OS-1048" },
      ],
    };
    const result = addOrder(state, {
      client: "Bianca Lima",
      car: "Yamaha NMax 2025",
      service: "Revisão geral",
      value: 450,
      mechanic: "Rafael",
    });

    expect(result.orders[0].id).toBe("OS-1049");
  });

  it("sorts new appointments chronologically", () => {
    const result = addAppointment(
      {
        ...initialWorkshopState,
        appointments: initialWorkshopState.appointments.slice(0, 1),
      },
      {
        time: "07:45",
        client: "Bianca Lima",
        car: "Yamaha NMax 2025",
        service: "Revisão",
        mechanic: "Rafael",
      },
    );

    expect(result.appointments.map((item) => item.time)).toEqual([
      "07:45",
      "08:30",
    ]);
  });

  it("round-trips versioned workshop data without losing records", () => {
    const changed = addOrder(initialWorkshopState, {
      client: "Bianca Lima",
      car: "Yamaha NMax 2025",
      service: "Revisão geral",
      value: 450,
      mechanic: "Rafael",
    });

    const restored = parseWorkshop(serializeWorkshop(changed));

    expect(restored.orders[0]).toMatchObject({
      id: "OS-1049",
      client: "Bianca Lima",
      value: 450,
    });
  });

  it("escapes commas, quotes and line breaks in CSV fields", () => {
    const order = {
      ...initialWorkshopState.orders[0],
      client: 'Ana, "Naná"',
      service: "Troca\nde óleo",
    };

    expect(ordersToCsv([order])).toBe(
      "Ordem,Cliente,Veículo,Serviço,Responsável,Status,Valor,Data\r\n" +
        'OS-1048,"Ana, ""Naná""",Toyota Corolla 2021,"Troca\nde óleo",Rafael,Em execução,1240,"Hoje, 14:30"',
    );
  });

  it("formats the current heading date in Brazilian Portuguese", () => {
    expect(formatLongDate(new Date(2026, 8, 19))).toBe(
      "SÁBADO, 19 DE SETEMBRO",
    );
  });

  it("formats the agenda date without hard-coded calendar text", () => {
    expect(formatAgendaDate(new Date(2026, 8, 19))).toEqual({
      date: "19 de setembro",
      weekday: "sábado",
    });
  });
});
