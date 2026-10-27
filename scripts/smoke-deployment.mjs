import { pathToFileURL } from "node:url";

const PHOTO_PROBE_ID = "00000000-0000-4000-8000-000000000000";

function deploymentOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("A URL base deve usar HTTP ou HTTPS.");
  }
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error("A URL base deve usar HTTP ou HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("A URL base não pode conter credenciais.");
  }
  return url.origin;
}

function assertSafeRedirect(response, origin, label) {
  if (response.status < 300 || response.status >= 400) return;
  const location = response.headers.get("location");
  if (!location) throw new Error(`${label}: redirecionamento sem destino.`);
  if (new URL(location, origin).origin !== origin) {
    throw new Error(`${label}: redirecionamento fora da origem informada.`);
  }
}

function expectStatus(response, status, label) {
  if (response.status !== status) {
    throw new Error(`${label}: resposta HTTP ${response.status}; esperado ${status}.`);
  }
}

function expectContentType(response, expected, label) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!expected.some((value) => contentType.includes(value))) {
    throw new Error(`${label}: tipo de conteúdo inesperado.`);
  }
}

export async function runSmoke({
  baseUrl,
  fetchImpl = fetch,
  timeoutMs = 10_000,
  log = console.log,
}) {
  const origin = deploymentOrigin(baseUrl);
  let passed = 0;

  async function request(path, label) {
    const response = await fetchImpl(new URL(path, origin), {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    assertSafeRedirect(response, origin, label);
    return response;
  }

  function pass(label) {
    passed += 1;
    log(`[ok] ${label}`);
  }

  const login = await request("/login", "login");
  expectStatus(login, 200, "login");
  expectContentType(login, ["text/html"], "login");
  if (!(await login.text()).includes("Acesso do proprietário")) {
    throw new Error("login: tela do proprietário não encontrada.");
  }
  pass("login");

  const manifestResponse = await request(
    "/manifest.webmanifest",
    "manifest",
  );
  expectStatus(manifestResponse, 200, "manifest");
  expectContentType(
    manifestResponse,
    ["application/manifest+json", "application/json"],
    "manifest",
  );
  const manifest = await manifestResponse.json();
  if (
    manifest?.start_url !== "/" ||
    manifest?.scope !== "/" ||
    manifest?.display !== "standalone" ||
    !Array.isArray(manifest?.icons) ||
    manifest.icons.length === 0
  ) {
    throw new Error("manifest: metadados de instalação incompletos.");
  }
  pass("manifest");

  const worker = await request("/sw.js", "service worker");
  expectStatus(worker, 200, "service worker");
  expectContentType(
    worker,
    ["application/javascript", "text/javascript"],
    "service worker",
  );
  pass("service worker");

  const logo = await request("/logo.jpg", "logo");
  expectStatus(logo, 200, "logo");
  expectContentType(logo, ["image/jpeg"], "logo");
  pass("logo");

  for (const icon of manifest.icons) {
    const iconUrl = new URL(icon.src, origin);
    if (iconUrl.origin !== origin) {
      throw new Error("manifest: ícone fora da origem informada.");
    }
    const response = await request(iconUrl.pathname, `ícone ${iconUrl.pathname}`);
    expectStatus(response, 200, `ícone ${iconUrl.pathname}`);
    expectContentType(response, [icon.type || "image/png"], `ícone ${iconUrl.pathname}`);
    pass(`ícone ${iconUrl.pathname}`);
  }

  const photo = await request(`/api/photos/${PHOTO_PROBE_ID}`, "foto privada");
  if (![301, 302, 303, 307, 308, 401, 403, 404].includes(photo.status)) {
    throw new Error("foto privada: conteúdo acessível sem sessão.");
  }
  const photoType = photo.headers.get("content-type")?.toLowerCase() ?? "";
  if (photoType.startsWith("image/")) {
    throw new Error("foto privada: imagem exposta sem sessão.");
  }
  pass("foto privada");

  async function expectProtected(path, label) {
    const response = await request(path, label);
    if (![301, 302, 303, 307, 308, 401, 403].includes(response.status)) throw new Error(`${label}: rota privada acessível sem sessão.`);
    pass(label);
  }

  await expectProtected("/", "dashboard mensal protegido");
  await expectProtected(`/clientes/${PHOTO_PROBE_ID}`, "edição de cliente protegida");
  await expectProtected(`/veiculos/${PHOTO_PROBE_ID}`, "edição e consulta de veículo protegidas");
  await expectProtected("/ordens", "criação e vistoria de OS protegidas");
  await expectProtected(`/ordens/${PHOTO_PROBE_ID}/imprimir`, "impressão A4 protegida");
  await expectProtected("/colaboradores", "colaboradores protegidos");
  await expectProtected("/financeiro?period=current_year&status=expected&recognition=accrual", "filtros financeiros protegidos");
  await expectProtected("/financeiro/receber?due=overdue", "contas a receber protegidas");
  await expectProtected("/financeiro/pagar?status=expected", "contas a pagar protegidas");
  await expectProtected("/financeiro/caixa", "controle de caixa protegido");
  await expectProtected("/financeiro/relatorios?period=current_month", "relatórios financeiros protegidos");
  await expectProtected("/api/financeiro/business-fin?from=2026-01-01&to=2026-12-31", "exportação Business Fin protegida");
  await expectProtected("/api/veiculos/consultar-placa?plate=ABC1D23", "consulta de placa protegida");
  await expectProtected("/retencao", "retenção protegida");
  await expectProtected("/estoque", "estoque protegido");
  await expectProtected("/configuracoes", "configurações protegidas");

  const cron = await request("/api/cron/whatsapp-reminders", "cron do WhatsApp");
  expectStatus(cron, 401, "cron do WhatsApp");
  pass("cron do WhatsApp");

  const missingQuote = await request(`/orcamento/${PHOTO_PROBE_ID}`, "orçamento público inexistente");
  expectStatus(missingQuote, 404, "orçamento público inexistente");
  pass("orçamento público inexistente");

  return { checks: passed, passed };
}

async function cli() {
  const [baseUrl, ...extra] = process.argv.slice(2);
  if (!baseUrl || extra.length > 0) {
    throw new Error("Uso: npm run smoke:deployment -- <base-url>");
  }
  const result = await runSmoke({ baseUrl });
  console.log(`Smoke concluído: ${result.passed}/${result.checks}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli().catch((error) => {
    console.error(`Falha no smoke: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    process.exitCode = 1;
  });
}
