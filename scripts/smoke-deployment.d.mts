export type SmokeOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  log?: (message: string) => void;
};

export function runSmoke(options: SmokeOptions): Promise<{
  checks: number;
  passed: number;
}>;
