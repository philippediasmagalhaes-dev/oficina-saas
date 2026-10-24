import { describe, expect, it } from "vitest";
import {
  APPROVED_SHOFICINA_BACKUP_HASH,
  assertLegacyImportComplete,
  assertLegacySourceHash,
  buildLegacyVehicle,
  mapLegacyOrderStatus,
  normalizeLegacyDocument,
  normalizeLegacyPhone,
  parseLegacyDate,
  parseLegacyPhotoName,
  reaisToCents,
  resolveLegacyOrderNumber,
  safeLegacyImportError,
  isLegacyImportLeaseExpired,
} from "./legacy-shoficina-import";

describe("SHOficina legacy import transformations", () => {
  it("normalizes Brazilian phones without granting consent", () => {
    expect(normalizeLegacyPhone("(11) 97788-1220")).toBe("5511977881220");
    expect(normalizeLegacyPhone("11 3777-1000")).toBe("551137771000");
    expect(normalizeLegacyPhone("")).toBeNull();
  });

  it("normalizes documents and rejects empty values", () => {
    expect(normalizeLegacyDocument("123.456.789-09")).toBe("12345678909");
    expect(normalizeLegacyDocument("  ")).toBeNull();
  });

  it("converts decimal reais to integer cents without floating point drift", () => {
    expect(reaisToCents("19,90")).toBe(1990);
    expect(reaisToCents(125.55)).toBe(12555);
    expect(reaisToCents(null)).toBe(0);
    expect(reaisToCents(-10)).toBe(0);
  });

  it("maps every legacy workflow state to a supported order state", () => {
    expect(mapLegacyOrderStatus("Equipamento entregue reparado", false)).toBe(
      "delivered",
    );
    expect(mapLegacyOrderStatus("Pronto, cliente avisado", false)).toBe(
      "ready",
    );
    expect(mapLegacyOrderStatus("Autorizado, Aguardando peça", false)).toBe(
      "in_progress",
    );
    expect(
      mapLegacyOrderStatus("Aguardando autorização do orçamento", false),
    ).toBe("awaiting_approval");
    expect(mapLegacyOrderStatus("Aguardando avaliação do técnico", false)).toBe(
      "diagnosis",
    );
    expect(mapLegacyOrderStatus("Equipamento Condenado", false)).toBe(
      "cancelled",
    );
    expect(mapLegacyOrderStatus("", true)).toBe("delivered");
    expect(mapLegacyOrderStatus(null, false)).toBe("open");
  });

  it("maps the workshop custom vehicle fields and extracts the year", () => {
    expect(
      buildLegacyVehicle(
        {
          CODIGO: 42,
          DESCRICAO: "CORSA GL 1600/1997",
          MARCA: "Chevrolet",
          MODELO: "Preta",
          SERIE: "FGY0A18",
          PAT: "9BGVC733712",
        },
        new Set(),
      ),
    ).toEqual({
      legacyId: "42",
      plate: "FGY0A18",
      plateNormalized: "FGY0A18",
      make: "Chevrolet",
      model: "CORSA GL 1600",
      year: 1997,
      color: "Preta",
      maskedChassis: "******33712",
      originalPlate: null,
    });
  });

  it("creates stable placeholders for invalid and duplicate plates", () => {
    const used = new Set<string>();
    expect(
      buildLegacyVehicle(
        { CODIGO: 7, DESCRICAO: "Veículo sem placa", SERIE: "" },
        used,
      ),
    ).toEqual(
      expect.objectContaining({ plate: "SEMPLACA-7", plateNormalized: null }),
    );
    expect(
      buildLegacyVehicle(
        { CODIGO: 8, DESCRICAO: "Outro", SERIE: "ABC-1234" },
        used,
      ),
    ).toEqual(
      expect.objectContaining({ plate: "ABC1234", originalPlate: null }),
    );
    expect(
      buildLegacyVehicle(
        { CODIGO: 9, DESCRICAO: "Duplicado", SERIE: "ABC-1234" },
        used,
      ),
    ).toEqual(
      expect.objectContaining({
        plate: "ABC1234-LEG9",
        plateNormalized: null,
        originalPlate: "ABC1234",
      }),
    );
  });

  it("parses only valid legacy photo names", () => {
    expect(parseLegacyPhotoName("Fotos/O0004841.Bmp")).toEqual({
      orderNumber: 484,
      index: 1,
    });
    expect(parseLegacyPhotoName("O0012106.bmp")).toEqual({
      orderNumber: 1210,
      index: 6,
    });
    expect(parseLegacyPhotoName("Fotos/outro.bmp")).toBeNull();
  });

  it("parses ISO and PowerShell JSON dates", () => {
    expect(parseLegacyDate("2026-10-20T19:22:42.000Z")?.toISOString()).toBe(
      "2026-10-20T19:22:42.000Z",
    );
    expect(parseLegacyDate("/Date(1792524162000)/")?.getTime()).toBe(
      1792524162000,
    );
    expect(parseLegacyDate(null)).toBeNull();
  });

  it("preserves a free legacy order number and allocates safely on collision", () => {
    const occupied = new Set([1, 2, 484]);
    expect(resolveLegacyOrderNumber(1292, occupied, 1293)).toEqual({
      orderNumber: 1292,
      nextOrderNumber: 1293,
      collided: false,
    });
    occupied.add(1292);
    expect(resolveLegacyOrderNumber(484, occupied, 1293)).toEqual({
      orderNumber: 1293,
      nextOrderNumber: 1294,
      collided: true,
    });
  });

  it("accepts only the explicitly approved backup hash", () => {
    expect(() =>
      assertLegacySourceHash(APPROVED_SHOFICINA_BACKUP_HASH),
    ).not.toThrow();
    expect(() => assertLegacySourceHash("A".repeat(64))).toThrow(
      "não corresponde ao arquivo aprovado",
    );
  });

  it("blocks a commit when any source item or photo would be skipped", () => {
    expect(() =>
      assertLegacyImportComplete({
        skippedServiceItems: 0,
        skippedPartItems: 0,
        skippedPhotos: 0,
      }),
    ).not.toThrow();
    expect(() =>
      assertLegacyImportComplete({
        skippedServiceItems: 1,
        skippedPartItems: 0,
        skippedPhotos: 0,
      }),
    ).toThrow("incompleta");
    expect(() =>
      assertLegacyImportComplete({
        skippedServiceItems: 0,
        skippedPartItems: 2,
        skippedPhotos: 0,
      }),
    ).toThrow("incompleta");
    expect(() =>
      assertLegacyImportComplete({
        skippedServiceItems: 0,
        skippedPartItems: 0,
        skippedPhotos: 1,
      }),
    ).toThrow("incompleta");
  });

  it("never returns database details that could contain PII", () => {
    const message = safeLegacyImportError(
      new Error("insert into customers values ('Nome', '11999999999')"),
    );
    expect(message).toBe("A importação falhou e a transação foi revertida.");
    expect(message).not.toContain("Nome");
    expect(message).not.toContain("11999999999");
  });

  it("recovers only abandoned import leases", () => {
    const now = new Date("2026-10-24T12:00:00.000Z");
    expect(
      isLegacyImportLeaseExpired(new Date("2026-10-24T11:29:59.999Z"), now),
    ).toBe(true);
    expect(
      isLegacyImportLeaseExpired(new Date("2026-10-24T11:30:00.001Z"), now),
    ).toBe(false);
  });
});
