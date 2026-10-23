import vinextWorker from "vinext/server/fetch-handler";

type WorkerEnvironment = { BETTER_AUTH_URL?: string; NEXT_PUBLIC_APP_URL?: string; CRON_SECRET?: string };
type WorkerContext = { waitUntil(promise: Promise<unknown>): void };
type VinextWorker = { fetch(request: Request, env: WorkerEnvironment, context: WorkerContext): Promise<Response> };

const app = vinextWorker as unknown as VinextWorker;

export default {
  fetch(request: Request, env: WorkerEnvironment, context: WorkerContext) {
    return app.fetch(request, env, context);
  },
  scheduled(_controller: unknown, env: WorkerEnvironment, context: WorkerContext) {
    const origin = env.NEXT_PUBLIC_APP_URL || env.BETTER_AUTH_URL;
    if (!origin || !env.CRON_SECRET) return;
    context.waitUntil(app.fetch(new Request(new URL("/api/cron/whatsapp-reminders", origin), { method: "POST", headers: { Authorization: `Bearer ${env.CRON_SECRET}` } }), env, context).then(() => undefined));
  },
};
