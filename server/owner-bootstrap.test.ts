import { describe, expect, it, vi } from "vitest";
import { createOwnerBootstrapService } from "./owner-bootstrap";

describe("first owner bootstrap", () => {
  it("normalizes the identity and stores a password hash for the first owner", async () => {
    const createIfEmpty = vi.fn().mockResolvedValue(true);
    const hashPassword = vi.fn().mockResolvedValue("secure-hash");
    const service = createOwnerBootstrapService({
      createIfEmpty,
      hashPassword,
    });

    const result = await service.register({
      name: "  Philippe  ",
      email: "  PHILIPPE@example.com  ",
      password: "uma-senha-segura",
      passwordConfirmation: "uma-senha-segura",
    });

    expect(result).toEqual({ created: true });
    expect(createIfEmpty).toHaveBeenCalledWith({
      name: "Philippe",
      email: "philippe@example.com",
      passwordHash: "secure-hash",
    });
  });

  it("keeps registration closed when an owner already exists", async () => {
    const service = createOwnerBootstrapService({
      createIfEmpty: vi.fn().mockResolvedValue(false),
      hashPassword: vi.fn().mockResolvedValue("secure-hash"),
    });

    await expect(
      service.register({
        name: "Outro proprietário",
        email: "outro@example.com",
        password: "uma-senha-segura",
        passwordConfirmation: "uma-senha-segura",
      }),
    ).resolves.toEqual({ created: false });
  });

  it("rejects invalid registration before touching persistence", async () => {
    const createIfEmpty = vi.fn().mockResolvedValue(true);
    const service = createOwnerBootstrapService({
      createIfEmpty,
      hashPassword: vi.fn().mockResolvedValue("secure-hash"),
    });

    await expect(
      service.register({
        name: "P",
        email: "email-invalido",
        password: "curta",
        passwordConfirmation: "diferente",
      }),
    ).rejects.toThrow("Revise os dados do primeiro acesso.");
    expect(createIfEmpty).not.toHaveBeenCalled();
  });
});
