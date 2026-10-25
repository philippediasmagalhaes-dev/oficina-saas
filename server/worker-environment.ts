export function syncWorkerEnvironment(
  workerEnv: Record<string, unknown>,
  processEnv: Record<string, string | undefined> = process.env,
) {
  for (const [name, value] of Object.entries(workerEnv)) {
    if (typeof value === "string") processEnv[name] = value;
  }
}
