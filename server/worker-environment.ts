const WORKER_ENVIRONMENT_KEY = "__OFICINA_WORKER_ENVIRONMENT__";

type RuntimeStore = Record<string, unknown>;

export function syncWorkerEnvironment(
  workerEnv: Record<string, unknown>,
  processEnv: Record<string, string | undefined> = process.env,
  runtimeStore: RuntimeStore = globalThis as unknown as RuntimeStore,
) {
  const textBindings: Record<string, string> = {};
  for (const [name, value] of Object.entries(workerEnv)) {
    if (typeof value !== "string") continue;
    processEnv[name] = value;
    textBindings[name] = value;
  }
  runtimeStore[WORKER_ENVIRONMENT_KEY] = textBindings;
}

export function getWorkerEnvironment(
  fallback: Record<string, string | undefined> = process.env,
  runtimeStore: RuntimeStore = globalThis as unknown as RuntimeStore,
) {
  const workerEnv = runtimeStore[WORKER_ENVIRONMENT_KEY];
  return {
    ...fallback,
    ...(workerEnv && typeof workerEnv === "object"
      ? (workerEnv as Record<string, string>)
      : {}),
  };
}
