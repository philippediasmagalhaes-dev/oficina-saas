import { describe, expect, it } from "vitest";
import { signMechanicAccess, verifyMechanicAccess } from "./mechanic-access";

const secret = "test-secret-with-at-least-32-characters";
describe("mechanic execution link", () => {
  it("binds a signed link to a workshop and one order", async () => {
    const token = await signMechanicAccess({ workshopId: "w", serviceRecordId: "s" }, secret, 1000);
    expect(await verifyMechanicAccess(token, secret, 2000)).toMatchObject({ workshopId: "w", serviceRecordId: "s" });
    expect(await verifyMechanicAccess(token + "x", secret, 2000)).toBeNull();
    expect(await verifyMechanicAccess(token, "different-secret", 2000)).toBeNull();
  });
  it("rejects expired links", async () => {
    const token = await signMechanicAccess({ workshopId: "w", serviceRecordId: "s" }, secret, 1000);
    expect(await verifyMechanicAccess(token, secret, 1000 + 8 * 3600000)).toBeNull();
  });
});
