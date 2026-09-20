import { describe, expect, it } from "vitest";
import { readServerConfig } from "./config";

describe("server configuration", () => {
  it("reports every missing production dependency", () => {
    expect(readServerConfig({})).toEqual({
      configured: false,
      missing: ["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET"],
    });
  });

  it("treats a short cookie secret as missing", () => {
    expect(
      readServerConfig({
        DATABASE_URL: "postgresql://example",
        BETTER_AUTH_URL: "https://auth.example",
        BETTER_AUTH_SECRET: "short",
      }),
    ).toEqual({
      configured: false,
      missing: ["BETTER_AUTH_SECRET"],
    });
  });

  it("accepts a complete configuration", () => {
    expect(
      readServerConfig({
        DATABASE_URL: "postgresql://example",
        BETTER_AUTH_URL: "https://auth.example",
        BETTER_AUTH_SECRET: "x".repeat(32),
      }),
    ).toEqual({
      configured: true,
      values: {
        databaseUrl: "postgresql://example",
        betterAuthUrl: "https://auth.example",
        betterAuthSecret: "x".repeat(32),
      },
    });
  });
});
