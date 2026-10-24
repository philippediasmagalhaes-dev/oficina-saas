import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { and, eq, lte, sql } from "drizzle-orm";
import {
  createDatabase,
  runDatabaseTransactionForUrl,
  type DatabaseTransaction,
} from "../db/client";
import {
  customers,
  legacyImportMappings,
  legacyImportRuns,
  serviceCatalogItems,
  servicePhotos,
  serviceRecords,
  vehicles,
  workOrderItems,
  workshops,
  workshopSequences,
} from "../db/schema";
import {
  assertLegacyImportComplete,
  assertLegacySourceHash,
  buildLegacyVehicle,
  cleanLegacyText,
  mapLegacyOrderStatus,
  normalizeLegacyDocument,
  normalizeLegacyPhone,
  normalizeLegacyPlate,
  parseLegacyDate,
  parseLegacyPhotoName,
  reaisToCents,
  resolveLegacyOrderDates,
  resolveLegacyOrderNumber,
  safeLegacyImportError,
  isLegacyImportLeaseExpired,
  LEGACY_IMPORT_LEASE_MS,
  type ImportedOrderStatus,
} from "../server/legacy-shoficina-import";

const SOURCE_SYSTEM = "SHOficina";
type LegacyRow = Record<string, unknown>;
type LegacyDataset = {
  sourceHash: string;
  customers: LegacyRow[];
  vehicles: LegacyRow[];
  orders: LegacyRow[];
  serviceItems: LegacyRow[];
  partItems: LegacyRow[];
  serviceCatalog: LegacyRow[];
  statuses: LegacyRow[];
  photos: Array<{ fileName: string; sizeBytes: number; dataBase64: string }>;
};

type PendingMapping = {
  entityType: string;
  legacyId: string;
  targetId: string;
  metadata?: Record<string, unknown>;
};

type ImportPlan = {
  customers: Array<typeof customers.$inferInsert>;
  vehicles: Array<typeof vehicles.$inferInsert>;
  serviceCatalog: Array<typeof serviceCatalogItems.$inferInsert>;
  orders: Array<typeof serviceRecords.$inferInsert>;
  items: Array<typeof workOrderItems.$inferInsert>;
  photos: Array<typeof servicePhotos.$inferInsert>;
  mappings: PendingMapping[];
  nextOrderNumber: number;
  summary: Record<string, number | boolean | string>;
};

function parseArguments(argv: string[]) {
  let zipPath = "";
  let workshopId: string | undefined;
  let commit = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--zip") zipPath = argv[++index] ?? "";
    else if (argv[index] === "--workshop-id") workshopId = argv[++index];
    else if (argv[index] === "--commit") commit = true;
    else throw new Error(`Argumento desconhecido: ${argv[index]}`);
  }
  if (!zipPath) throw new Error("Informe --zip com o caminho do SHBackup.zip.");
  return { zipPath: resolve(zipPath), workshopId, commit };
}

function extractDataset(zipPath: string): LegacyDataset {
  const workDirectory = mkdtempSync(join(tmpdir(), "shoficina-import-"));
  const outputPath = join(workDirectory, "dataset.json");
  try {
    const result = spawnSync(
      "pwsh",
      [
        "-NoProfile",
        "-File",
        resolve("scripts/extract-shoficina-backup.ps1"),
        "-ZipPath",
        zipPath,
        "-OutputPath",
        outputPath,
      ],
      { encoding: "utf8", maxBuffer: 1024 * 1024 },
    );
    if (result.status !== 0) {
      const message =
        result.stderr.trim().split(/\r?\n/).at(-1) || "falha desconhecida";
      throw new Error(`Falha na extração do backup: ${message}`);
    }
    const dataset = JSON.parse(
      readFileSync(outputPath, "utf8"),
    ) as LegacyDataset;
    const calculatedHash = createHash("sha256")
      .update(readFileSync(zipPath))
      .digest("hex")
      .toUpperCase();
    if (dataset.sourceHash !== calculatedHash)
      throw new Error("O hash do backup mudou durante a extração.");
    assertLegacySourceHash(dataset.sourceHash);
    return dataset;
  } finally {
    rmSync(workDirectory, { recursive: true, force: true });
  }
}

function normalizedName(value: unknown) {
  return (
    cleanLegacyText(value)
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase() ?? ""
  );
}

function numberValue(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed =
    typeof value === "string"
      ? Number(value.trim().replace(/\./g, "").replace(",", "."))
      : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function positiveInteger(value: unknown): number | null {
  const parsed = Math.trunc(numberValue(value));
  return parsed > 0 ? parsed : null;
}

function joinNotes(parts: Array<[string, unknown]>) {
  const values = parts.flatMap(([label, value]) => {
    const text = cleanLegacyText(value);
    return text ? [`${label}: ${text}`] : [];
  });
  return values.length ? values.join("\n") : null;
}

function customerKey(name: unknown, phone: unknown) {
  const normalizedPhone = normalizeLegacyPhone(phone);
  const normalizedCustomerName = normalizedName(name);
  return normalizedPhone && normalizedCustomerName
    ? `${normalizedCustomerName}|${normalizedPhone}`
    : null;
}

function quoteStatusFor(
  status: ImportedOrderStatus,
): "draft" | "sent" | "approved" | "rejected" {
  if (status === "awaiting_approval") return "sent";
  if (
    ["approved", "in_progress", "ready", "completed", "delivered"].includes(
      status,
    )
  )
    return "approved";
  if (status === "cancelled") return "rejected";
  return "draft";
}

function itemStates(status: ImportedOrderStatus) {
  const approved = [
    "approved",
    "in_progress",
    "ready",
    "completed",
    "delivered",
  ].includes(status);
  const completed = ["ready", "completed", "delivered"].includes(status);
  return {
    approvalState:
      status === "cancelled" ? "rejected" : approved ? "approved" : "pending",
    completionState: completed ? "completed" : "pending",
  };
}

function orderTotalCents(row: LegacyRow) {
  const gross =
    numberValue(row.V_MAO) +
    numberValue(row.V_PECAS) +
    numberValue(row.V_DESLOCA) +
    numberValue(row.V_TERCEIRO) +
    numberValue(row.V_OUTROS) -
    numberValue(row.V_DESCONTOS);
  return Math.max(0, Math.round((gross + Number.EPSILON) * 100));
}

async function buildPlan(
  database: ReturnType<typeof createDatabase>,
  dataset: LegacyDataset,
  workshopId: string,
): Promise<ImportPlan> {
  const [
    existingCustomers,
    existingVehicles,
    existingCatalog,
    existingOrders,
    existingMappings,
    sequenceRows,
  ] = await Promise.all([
    database
      .select()
      .from(customers)
      .where(eq(customers.workshopId, workshopId)),
    database.select().from(vehicles).where(eq(vehicles.workshopId, workshopId)),
    database
      .select()
      .from(serviceCatalogItems)
      .where(eq(serviceCatalogItems.workshopId, workshopId)),
    database
      .select({
        id: serviceRecords.id,
        orderNumber: serviceRecords.orderNumber,
      })
      .from(serviceRecords)
      .where(eq(serviceRecords.workshopId, workshopId)),
    database
      .select()
      .from(legacyImportMappings)
      .where(
        and(
          eq(legacyImportMappings.workshopId, workshopId),
          eq(legacyImportMappings.sourceSystem, SOURCE_SYSTEM),
        ),
      ),
    database
      .select()
      .from(workshopSequences)
      .where(eq(workshopSequences.workshopId, workshopId)),
  ]);

  const mapped = new Map(
    existingMappings.map((mapping) => [
      `${mapping.entityType}:${mapping.legacyId}`,
      mapping.targetId,
    ]),
  );
  const pendingMappings: PendingMapping[] = [];
  const customerInserts: Array<typeof customers.$inferInsert> = [];
  const vehicleInserts: Array<typeof vehicles.$inferInsert> = [];
  const catalogInserts: Array<typeof serviceCatalogItems.$inferInsert> = [];
  const orderInserts: Array<typeof serviceRecords.$inferInsert> = [];
  const itemInserts: Array<typeof workOrderItems.$inferInsert> = [];
  const photoInserts: Array<typeof servicePhotos.$inferInsert> = [];
  let reused = 0;
  let alreadyMapped = 0;
  let orderCollisions = 0;
  let duplicatePlates = 0;

  const customersByDocument = new Map(
    existingCustomers.flatMap((customer) =>
      customer.document
        ? [[normalizeLegacyDocument(customer.document), customer.id] as const]
        : [],
    ),
  );
  const customersByNamePhone = new Map(
    existingCustomers.flatMap((customer) => {
      const key = customerKey(
        customer.name,
        customer.phoneNormalized ?? customer.phone,
      );
      return key ? [[key, customer.id] as const] : [];
    }),
  );
  const customerTargets = new Map<string, string>();

  for (const row of dataset.customers) {
    const legacyId = String(row.CODIGO);
    const mappingKey = `customer:${legacyId}`;
    const previous = mapped.get(mappingKey);
    if (previous) {
      customerTargets.set(legacyId, previous);
      alreadyMapped += 1;
      continue;
    }
    const document = normalizeLegacyDocument(row.CPF_CNPJ);
    const selectedPhone = normalizeLegacyPhone(row.CELULAR)
      ? row.CELULAR
      : row.TELEFONE;
    const phoneNormalized = normalizeLegacyPhone(selectedPhone);
    const namePhone = customerKey(row.NOME, phoneNormalized);
    let targetId =
      (document && customersByDocument.get(document)) ||
      (namePhone && customersByNamePhone.get(namePhone)) ||
      undefined;
    if (targetId) reused += 1;
    else {
      targetId = randomUUID();
      const name = cleanLegacyText(row.NOME) ?? `Cliente legado ${legacyId}`;
      customerInserts.push({
        id: targetId,
        workshopId,
        name,
        phone: cleanLegacyText(selectedPhone),
        phoneNormalized,
        email: cleanLegacyText(row.EMAIL),
        document,
        addressStreet: cleanLegacyText(row.ENDERECO),
        addressNumber: cleanLegacyText(row.NUMERO),
        addressComplement: cleanLegacyText(row.COMPLEM),
        addressDistrict: cleanLegacyText(row.BAIRRO),
        addressCity: cleanLegacyText(row.CIDADE),
        addressState: cleanLegacyText(row.UF)?.toUpperCase() ?? null,
        addressPostalCode: cleanLegacyText(row.CEP),
        whatsappConsent: false,
        notes: joinNotes([
          ["Observação legada", row.OBSERVACAO],
          ["Contato legado", row.CONTATO],
          ["RG/IE legado", row.IE_RG],
        ]),
        createdAt: parseLegacyDate(row.CADASTRADO) ?? new Date(),
      });
      if (document) customersByDocument.set(document, targetId);
      if (namePhone) customersByNamePhone.set(namePhone, targetId);
    }
    customerTargets.set(legacyId, targetId);
    pendingMappings.push({ entityType: "customer", legacyId, targetId });
  }

  const orphanedOrders = dataset.orders.filter(
    (row) => !customerTargets.has(String(row.COD_CLIENTE)),
  ).length;
  let orphanCustomerId = mapped.get("customer:__orphan__");
  if (orphanedOrders && !orphanCustomerId) {
    orphanCustomerId = existingCustomers.find(
      (customer) => customer.name === "Cliente legado não identificado",
    )?.id;
    if (orphanCustomerId) reused += 1;
    else {
      orphanCustomerId = randomUUID();
      customerInserts.push({
        id: orphanCustomerId,
        workshopId,
        name: "Cliente legado não identificado",
        whatsappConsent: false,
        notes:
          "Registro técnico criado para preservar ordens órfãs do SHOficina.",
      });
    }
    pendingMappings.push({
      entityType: "customer",
      legacyId: "__orphan__",
      targetId: orphanCustomerId,
    });
  }

  const existingPlateTargets = new Map(
    existingVehicles.flatMap((vehicle) => {
      const plate =
        vehicle.plateNormalized ?? normalizeLegacyPlate(vehicle.plate);
      return plate ? [[plate, vehicle.id] as const] : [];
    }),
  );
  const usedPlates = new Set(existingVehicles.map((vehicle) => vehicle.plate));
  const vehicleTargets = new Map<string, string>();
  for (const row of dataset.vehicles) {
    const legacyId = String(row.CODIGO);
    const previous = mapped.get(`vehicle:${legacyId}`);
    if (previous) {
      vehicleTargets.set(legacyId, previous);
      alreadyMapped += 1;
      continue;
    }
    const normalized = normalizeLegacyPlate(row.SERIE);
    let targetId = normalized
      ? existingPlateTargets.get(normalized)
      : undefined;
    if (targetId) {
      reused += 1;
      vehicleTargets.set(legacyId, targetId);
      pendingMappings.push({
        entityType: "vehicle",
        legacyId,
        targetId,
        metadata: { reusedByPlate: true },
      });
      continue;
    }
    const transformed = buildLegacyVehicle(
      { ...row, CODIGO: row.CODIGO },
      usedPlates,
    );
    if (transformed.originalPlate) duplicatePlates += 1;
    targetId = randomUUID();
    const customerId =
      customerTargets.get(String(row.COD_CLIENTE)) ?? orphanCustomerId;
    if (!customerId) throw new Error("Veículo legado sem cliente recuperável.");
    vehicleInserts.push({
      id: targetId,
      workshopId,
      customerId,
      plate: transformed.plate,
      plateNormalized: transformed.plateNormalized,
      make: transformed.make,
      model: transformed.model,
      year: transformed.year,
      color: transformed.color,
      maskedChassis: transformed.maskedChassis,
      category: "car",
    });
    vehicleTargets.set(legacyId, targetId);
    pendingMappings.push({
      entityType: "vehicle",
      legacyId,
      targetId,
      metadata: {
        originalPlate: transformed.originalPlate,
        legacyNotesPresent: Boolean(cleanLegacyText(row.OBSERVACOES)),
      },
    });
  }

  const catalogByName = new Map(
    existingCatalog.map((item) => [normalizedName(item.name), item.id]),
  );
  const catalogTargets = new Map<string, string>();
  for (const row of dataset.serviceCatalog) {
    const legacyId = String(row.CODIGO);
    const previous = mapped.get(`service_catalog:${legacyId}`);
    if (previous) {
      catalogTargets.set(legacyId, previous);
      alreadyMapped += 1;
      continue;
    }
    const name = cleanLegacyText(row.DESCRICAO) ?? `Serviço legado ${legacyId}`;
    let targetId = catalogByName.get(normalizedName(name));
    if (targetId) reused += 1;
    else {
      targetId = randomUUID();
      catalogInserts.push({
        id: targetId,
        workshopId,
        name,
        defaultPriceCents: reaisToCents(row.VALOR),
        active: true,
      });
      catalogByName.set(normalizedName(name), targetId);
    }
    catalogTargets.set(legacyId, targetId);
    pendingMappings.push({ entityType: "service_catalog", legacyId, targetId });
  }

  const statusNames = new Map(
    dataset.statuses.map((row) => [
      String(row.CODIGO),
      cleanLegacyText(row.NOME),
    ]),
  );
  const occupiedOrderNumbers = new Set(
    existingOrders.flatMap((order) =>
      order.orderNumber ? [order.orderNumber] : [],
    ),
  );
  const highestOccupiedOrderNumber = occupiedOrderNumbers.size
    ? Math.max(...occupiedOrderNumbers)
    : 0;
  let nextOrderNumber = Math.max(
    sequenceRows[0]?.nextWorkOrderNumber ?? 1,
    highestOccupiedOrderNumber + 1,
  );
  const orderTargets = new Map<string, string>();
  const orderStatuses = new Map<string, ImportedOrderStatus>();
  const orderTotals = new Map<string, number>();
  const orderDates = new Map<string, Date>();
  const newOrdersById = new Map<string, typeof serviceRecords.$inferInsert>();
  const importedAt = new Date();

  for (const row of dataset.orders) {
    const legacyId = String(row.CODIGO);
    const dates = resolveLegacyOrderDates(row, importedAt);
    const previous = mapped.get(`work_order:${legacyId}`);
    const status = mapLegacyOrderStatus(
      statusNames.get(String(row.SITUACAO)),
      Boolean(parseLegacyDate(row.SAIDA)),
    );
    orderStatuses.set(legacyId, status);
    orderTotals.set(legacyId, orderTotalCents(row));
    orderDates.set(legacyId, dates.createdAt);
    if (previous) {
      orderTargets.set(legacyId, previous);
      alreadyMapped += 1;
      continue;
    }
    const resolvedNumber = resolveLegacyOrderNumber(
      Number(row.CODIGO),
      occupiedOrderNumbers,
      nextOrderNumber,
    );
    nextOrderNumber = resolvedNumber.nextOrderNumber;
    if (resolvedNumber.collided) orderCollisions += 1;
    const id = randomUUID();
    const enteredAt = dates.createdAt;
    const readyAt = parseLegacyDate(row.PRONTO);
    const exitAt = parseLegacyDate(row.SAIDA);
    const complaint = cleanLegacyText(row.DEFEITO);
    const notes = joinNotes([
      ["Observação do serviço", row.OBS_SERVICO],
      ["Observação do veículo", row.OBS_APARELHO],
      ["Acessórios", row.ACESSORIO],
      ...(resolvedNumber.collided
        ? [["Número da OS no sistema anterior", legacyId] as [string, unknown]]
        : []),
    ]);
    const order: typeof serviceRecords.$inferInsert = {
      id,
      workshopId,
      customerId:
        customerTargets.get(String(row.COD_CLIENTE)) ?? orphanCustomerId!,
      vehicleId: vehicleTargets.get(String(row.COD_EQUIP)) ?? null,
      orderNumber: resolvedNumber.orderNumber,
      description:
        complaint ??
        cleanLegacyText(row.APARELHO) ??
        `Ordem de serviço ${legacyId}`,
      complaint,
      diagnosis: cleanLegacyText(row.LAUDO),
      notes,
      status,
      quoteStatus: quoteStatusFor(status),
      quoteToken: randomUUID(),
      intakeAt: dates.intakeAt,
      amountCents: orderTotals.get(legacyId)!,
      quoteDiscountCents: 0,
      odometer: positiveInteger(row.KILOMET),
      warrantyDays: positiveInteger(row.GARANTIA),
      approvedAt: [
        "approved",
        "in_progress",
        "ready",
        "completed",
        "delivered",
      ].includes(status)
        ? (readyAt ?? enteredAt)
        : null,
      readyAt: ["ready", "completed", "delivered"].includes(status)
        ? (readyAt ?? exitAt ?? enteredAt)
        : null,
      completedAt: ["completed", "delivered"].includes(status)
        ? (exitAt ?? readyAt ?? enteredAt)
        : null,
      deliveredAt:
        status === "delivered" ? (exitAt ?? readyAt ?? enteredAt) : null,
      paymentStatus: "pending",
      createdAt: enteredAt,
      updatedAt: dates.updatedAt,
    };
    orderInserts.push(order);
    newOrdersById.set(id, order);
    orderTargets.set(legacyId, id);
    pendingMappings.push({
      entityType: "work_order",
      legacyId,
      targetId: id,
      metadata: {
        importedOrderNumber: resolvedNumber.orderNumber,
        numberCollision: resolvedNumber.collided,
        missingEntryDate: dates.intakeAt === null,
      },
    });
  }

  const subtotals = new Map<string, number>();
  const appendItem = (
    entityLegacyId: string,
    orderLegacyId: string,
    value: typeof workOrderItems.$inferInsert,
    metadata?: Record<string, unknown>,
  ) => {
    const previous = mapped.get(`work_order_item:${entityLegacyId}`);
    if (previous) {
      alreadyMapped += 1;
      return;
    }
    itemInserts.push(value);
    subtotals.set(
      orderLegacyId,
      (subtotals.get(orderLegacyId) ?? 0) +
        value.quantity! * value.unitPriceCents!,
    );
    pendingMappings.push({
      entityType: "work_order_item",
      legacyId: entityLegacyId,
      targetId: value.id!,
      metadata,
    });
  };

  let skippedServiceItems = 0;
  for (const row of dataset.serviceItems) {
    const orderLegacyId = String(row.OS_NUM);
    const serviceRecordId = orderTargets.get(orderLegacyId);
    if (!serviceRecordId) {
      skippedServiceItems += 1;
      continue;
    }
    const quantity = positiveInteger(row.QTD) ?? 1;
    const lineTotal = reaisToCents(row.TOTAL);
    const status = orderStatuses.get(orderLegacyId) ?? "open";
    appendItem(
      `service:${row.CODIGO}`,
      orderLegacyId,
      {
        id: randomUUID(),
        workshopId,
        serviceRecordId,
        type: "service",
        serviceCatalogId: catalogTargets.get(String(row.COD_SERV)) ?? null,
        description: cleanLegacyText(row.DESCRICAO) ?? "Serviço importado",
        quantity,
        unitPriceCents: Math.round(lineTotal / quantity),
        costCents: Math.round(reaisToCents(row.CUSTO) / quantity),
        discountCents: reaisToCents(row.DESCONTO),
        ...itemStates(status),
        reservationState: "none",
        createdAt: parseLegacyDate(row.INICIO) ?? orderDates.get(orderLegacyId),
      },
      { legacyDiscountCents: reaisToCents(row.DESCONTO) },
    );
  }

  let skippedPartItems = 0;
  for (const row of dataset.partItems) {
    const orderLegacyId = String(row.COD_OS);
    const serviceRecordId = orderTargets.get(orderLegacyId);
    if (!serviceRecordId) {
      skippedPartItems += 1;
      continue;
    }
    const quantity = positiveInteger(row.QTD) ?? 1;
    const status = orderStatuses.get(orderLegacyId) ?? "open";
    appendItem(
      `part:${row.CODIGO}`,
      orderLegacyId,
      {
        id: randomUUID(),
        workshopId,
        serviceRecordId,
        type: "part",
        inventoryItemId: null,
        description: cleanLegacyText(row.DESCRICAO) ?? "Peça importada",
        quantity,
        unitPriceCents: reaisToCents(row.VALOR),
        costCents: reaisToCents(row.CUSTO),
        discountCents: reaisToCents(row.DESCONTO),
        ...itemStates(status),
        reservationState: "none",
        createdAt: parseLegacyDate(row.DIA) ?? orderDates.get(orderLegacyId),
      },
      {
        legacyPartCode: cleanLegacyText(row.COD_PECA),
        legacyDiscountCents: reaisToCents(row.DESCONTO),
      },
    );
  }

  let adjustmentItems = 0;
  for (const [legacyId, targetId] of orderTargets) {
    const newOrder = newOrdersById.get(targetId);
    if (!newOrder) continue;
    const subtotal = subtotals.get(legacyId) ?? 0;
    const total = orderTotals.get(legacyId) ?? 0;
    if (subtotal > total) newOrder.quoteDiscountCents = subtotal - total;
    else if (total > subtotal) {
      const status = orderStatuses.get(legacyId) ?? "open";
      const id = randomUUID();
      appendItem(
        `adjustment:${legacyId}`,
        legacyId,
        {
          id,
          workshopId,
          serviceRecordId: targetId,
          type: "service",
          description: "Outros valores do sistema anterior",
          quantity: 1,
          unitPriceCents: total - subtotal,
          costCents: 0,
          discountCents: 0,
          ...itemStates(status),
          reservationState: "none",
          createdAt: orderDates.get(legacyId),
        },
        { generatedToReconcileTotal: true },
      );
      adjustmentItems += 1;
    }
  }

  let skippedPhotos = 0;
  for (const photo of dataset.photos) {
    const parsed = parseLegacyPhotoName(photo.fileName);
    const serviceRecordId = parsed
      ? orderTargets.get(String(parsed.orderNumber))
      : undefined;
    if (!parsed || !serviceRecordId) {
      skippedPhotos += 1;
      continue;
    }
    const previous = mapped.get(
      `service_photo:${photo.fileName.toUpperCase()}`,
    );
    if (previous) {
      alreadyMapped += 1;
      continue;
    }
    const id = randomUUID();
    photoInserts.push({
      id,
      workshopId,
      serviceRecordId,
      kind: "diagnosis",
      caption: "Foto importada do sistema anterior",
      fileName: photo.fileName,
      mimeType: "image/bmp",
      dataBase64: photo.dataBase64,
      sizeBytes: photo.sizeBytes,
      uploadedAt: orderDates.get(String(parsed.orderNumber)) ?? new Date(),
    });
    pendingMappings.push({
      entityType: "service_photo",
      legacyId: photo.fileName.toUpperCase(),
      targetId: id,
    });
  }

  return {
    customers: customerInserts,
    vehicles: vehicleInserts,
    serviceCatalog: catalogInserts,
    orders: orderInserts,
    items: itemInserts,
    photos: photoInserts,
    mappings: pendingMappings,
    nextOrderNumber,
    summary: {
      sourceCustomers: dataset.customers.length,
      sourceVehicles: dataset.vehicles.length,
      sourceOrders: dataset.orders.length,
      sourceItems: dataset.serviceItems.length + dataset.partItems.length,
      sourcePhotos: dataset.photos.length,
      newCustomers: customerInserts.length,
      newVehicles: vehicleInserts.length,
      newCatalogItems: catalogInserts.length,
      newOrders: orderInserts.length,
      newItems: itemInserts.length,
      newPhotos: photoInserts.length,
      reusedEntities: reused,
      alreadyMapped,
      orphanedOrders,
      duplicatePlates,
      orderNumberCollisions: orderCollisions,
      adjustmentItems,
      skippedServiceItems,
      skippedPartItems,
      skippedPhotos,
    },
  };
}

async function insertChunks(
  transaction: DatabaseTransaction,
  table: unknown,
  values: unknown[],
  size = 200,
) {
  for (let index = 0; index < values.length; index += size) {
    await (
      transaction as never as {
        insert: (target: unknown) => {
          values: (rows: unknown[]) => Promise<unknown>;
        };
      }
    )
      .insert(table)
      .values(values.slice(index, index + size));
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error(
      "Defina DATABASE_URL somente nesta sessão antes de executar a importação.",
    );
  const dataset = extractDataset(options.zipPath);
  const database = createDatabase(databaseUrl);
  const availableWorkshops = await database
    .select({ id: workshops.id, name: workshops.name })
    .from(workshops);
  const selected = options.workshopId
    ? availableWorkshops.find((workshop) => workshop.id === options.workshopId)
    : availableWorkshops.length === 1
      ? availableWorkshops[0]
      : undefined;
  if (!selected)
    throw new Error(
      availableWorkshops.length
        ? "Informe --workshop-id para selecionar a oficina correta."
        : "Nenhuma oficina foi encontrada no banco de destino.",
    );

  const [completedRun] = await database
    .select({ id: legacyImportRuns.id })
    .from(legacyImportRuns)
    .where(
      and(
        eq(legacyImportRuns.workshopId, selected.id),
        eq(legacyImportRuns.sourceSystem, SOURCE_SYSTEM),
        eq(legacyImportRuns.sourceHash, dataset.sourceHash),
        eq(legacyImportRuns.status, "completed"),
      ),
    )
    .limit(1);
  const plan = await buildPlan(database, dataset, selected.id);
  const report = {
    mode: options.commit ? "commit" : "dry-run",
    workshop: selected.name,
    sourceHash: dataset.sourceHash,
    alreadyImported: Boolean(completedRun),
    ...plan.summary,
  };
  if (!options.commit || completedRun) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  assertLegacyImportComplete({
    skippedServiceItems: Number(plan.summary.skippedServiceItems),
    skippedPartItems: Number(plan.summary.skippedPartItems),
    skippedPhotos: Number(plan.summary.skippedPhotos),
  });

  const [insertedRun] = await database
    .insert(legacyImportRuns)
    .values({
      workshopId: selected.id,
      sourceSystem: SOURCE_SYSTEM,
      sourceHash: dataset.sourceHash,
      status: "running",
      summary: report,
    })
    .onConflictDoNothing()
    .returning({ id: legacyImportRuns.id });

  let run = insertedRun;
  if (!run) {
    const [existingRun] = await database
      .select({
        id: legacyImportRuns.id,
        status: legacyImportRuns.status,
        startedAt: legacyImportRuns.startedAt,
      })
      .from(legacyImportRuns)
      .where(
        and(
          eq(legacyImportRuns.workshopId, selected.id),
          eq(legacyImportRuns.sourceSystem, SOURCE_SYSTEM),
          eq(legacyImportRuns.sourceHash, dataset.sourceHash),
        ),
      )
      .limit(1);
    if (existingRun?.status === "completed") {
      console.log(
        JSON.stringify({ ...report, alreadyImported: true }, null, 2),
      );
      return;
    }
    const claimTime = new Date();
    const staleRunning =
      existingRun?.status === "running" &&
      isLegacyImportLeaseExpired(existingRun.startedAt, claimTime);
    if (existingRun?.status === "failed" || staleRunning) {
      const leaseCutoff = new Date(
        claimTime.getTime() - LEGACY_IMPORT_LEASE_MS,
      );
      const [claimedRun] = await database
        .update(legacyImportRuns)
        .set({
          status: "running",
          summary: report,
          errorMessage: null,
          startedAt: claimTime,
          completedAt: null,
        })
        .where(
          and(
            eq(legacyImportRuns.id, existingRun.id),
            eq(legacyImportRuns.status, existingRun.status),
            staleRunning
              ? lte(legacyImportRuns.startedAt, leaseCutoff)
              : undefined,
          ),
        )
        .returning({ id: legacyImportRuns.id });
      run = claimedRun;
    }
    if (!run) throw new Error("Já existe uma importação em andamento.");
  }

  try {
    await runDatabaseTransactionForUrl(databaseUrl, async (transaction) => {
      await insertChunks(transaction, customers, plan.customers);
      await insertChunks(transaction, vehicles, plan.vehicles);
      await insertChunks(transaction, serviceCatalogItems, plan.serviceCatalog);
      await insertChunks(transaction, serviceRecords, plan.orders);
      await insertChunks(transaction, workOrderItems, plan.items);
      await insertChunks(transaction, servicePhotos, plan.photos, 25);
      await insertChunks(
        transaction,
        legacyImportMappings,
        plan.mappings.map((mapping) => ({
          ...mapping,
          runId: run.id,
          workshopId: selected.id,
          sourceSystem: SOURCE_SYSTEM,
        })),
      );
      await transaction
        .insert(workshopSequences)
        .values({
          workshopId: selected.id,
          nextWorkOrderNumber: plan.nextOrderNumber,
        })
        .onConflictDoUpdate({
          target: workshopSequences.workshopId,
          set: {
            nextWorkOrderNumber: sql`greatest(${workshopSequences.nextWorkOrderNumber}, ${plan.nextOrderNumber})`,
            updatedAt: new Date(),
          },
        });
      await transaction
        .update(legacyImportRuns)
        .set({
          status: "completed",
          summary: report,
          completedAt: new Date(),
          errorMessage: null,
        })
        .where(eq(legacyImportRuns.id, run.id));
    });
  } catch (error) {
    await database
      .update(legacyImportRuns)
      .set({
        status: "failed",
        errorMessage:
          "A transação foi revertida. Consulte o log local desta execução.",
        completedAt: new Date(),
      })
      .where(eq(legacyImportRuns.id, run.id));
    throw error;
  }
  console.log(JSON.stringify({ ...report, committed: true }, null, 2));
}

main().catch((error) => {
  console.error(safeLegacyImportError(error));
  process.exitCode = 1;
});
