import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const databaseDoubles = vi.hoisted(() => {
  const httpDatabase = { transport: "http" };
  const websocketDatabase = {
    transport: "websocket",
    transaction: vi.fn(async (operation: (transaction: object) => unknown) =>
      operation({ transport: "transaction" }),
    ),
  };

  return {
    httpDatabase,
    websocketDatabase,
    neon: vi.fn(() => ({ transport: "http-client" })),
    drizzleHttp: vi.fn(() => httpDatabase),
    drizzleWebSocket: vi.fn(() => websocketDatabase),
    createdPools: [] as Array<{
      connectionString: string;
      end: ReturnType<typeof vi.fn>;
    }>,
  };
});

vi.mock("@neondatabase/serverless", () => ({
  neonConfig: {},
  neon: databaseDoubles.neon,
  Pool: class {
    connectionString: string;
    end = vi.fn().mockResolvedValue(undefined);

    constructor({ connectionString }: { connectionString: string }) {
      this.connectionString = connectionString;
      databaseDoubles.createdPools.push(this);
    }
  },
}));

vi.mock("drizzle-orm/neon-http", () => ({
  drizzle: databaseDoubles.drizzleHttp,
}));

vi.mock("drizzle-orm/neon-serverless", () => ({
  drizzle: databaseDoubles.drizzleWebSocket,
}));

vi.mock("ws", () => ({ default: class NodeWebSocket {} }));

describe("database client lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    databaseDoubles.createdPools.length = 0;
    process.env.DATABASE_URL = "postgresql://example.test/oficina";
    process.env.BETTER_AUTH_URL = "https://oficina.example";
    process.env.BETTER_AUTH_SECRET = "x".repeat(32);
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.BETTER_AUTH_URL;
    delete process.env.BETTER_AUTH_SECRET;
  });

  it("uses the request-safe HTTP transport for ordinary queries", async () => {
    const { getDatabase } = await import("./client");

    const database = getDatabase();

    expect(database).toBe(databaseDoubles.httpDatabase);
    expect(databaseDoubles.neon).toHaveBeenCalledWith(
      "postgresql://example.test/oficina",
    );
    expect(databaseDoubles.createdPools).toHaveLength(0);
  });

  it("closes the request-local WebSocket pool after a transaction", async () => {
    const client = (await import("./client")) as unknown as {
      runDatabaseTransaction?: <T>(
        operation: (transaction: object) => Promise<T>,
      ) => Promise<T>;
    };

    expect(typeof client.runDatabaseTransaction).toBe("function");
    await expect(
      client.runDatabaseTransaction!(() => Promise.resolve("completed")),
    ).resolves.toBe("completed");
    expect(databaseDoubles.createdPools).toHaveLength(1);
    expect(databaseDoubles.createdPools[0].end).toHaveBeenCalledOnce();
  });

  it("closes the request-local WebSocket pool when a transaction fails", async () => {
    const client = (await import("./client")) as unknown as {
      runDatabaseTransaction?: <T>(
        operation: (transaction: object) => Promise<T>,
      ) => Promise<T>;
    };

    expect(typeof client.runDatabaseTransaction).toBe("function");
    await expect(
      client.runDatabaseTransaction!(() =>
        Promise.reject(new Error("transaction failed")),
      ),
    ).rejects.toThrow("transaction failed");
    expect(databaseDoubles.createdPools[0].end).toHaveBeenCalledOnce();
  });
});
