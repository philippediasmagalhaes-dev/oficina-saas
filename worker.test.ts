import { describe, expect, it, vi } from "vitest";
import { runScheduled } from "./worker";

describe("Cloudflare scheduled reminders", () => {
  it("fails the scheduled promise when the protected endpoint is unsuccessful", async () => {
    const waitUntil = vi.fn();
    runScheduled({ NEXT_PUBLIC_APP_URL: "https://example.test", CRON_SECRET: "secret" }, { waitUntil }, async () => new Response("error", { status: 500 }));
    expect(waitUntil).toHaveBeenCalledTimes(1);
    await expect(waitUntil.mock.calls[0][0]).rejects.toThrow("cron_500");
  });
});
