import { describe, expect, it } from "vitest";
import { downloadTextFile, type DownloadEnvironment } from "./download";

describe("text download", () => {
  it("clicks a named download and revokes its object URL", () => {
    const events: string[] = [];
    const link = {
      download: "",
      href: "",
      click: () => events.push("clicked"),
    };
    const environment: DownloadEnvironment = {
      createLink: () => link,
      createObjectURL: (blob) => {
        events.push(`blob:${blob.type}:${blob.size}`);
        return "blob:test";
      },
      revokeObjectURL: (url) => events.push(`revoked:${url}`),
    };

    downloadTextFile(
      "ordens.csv",
      "abc",
      "text/csv;charset=utf-8",
      environment,
    );

    expect(link).toMatchObject({ download: "ordens.csv", href: "blob:test" });
    expect(events).toEqual([
      "blob:text/csv;charset=utf-8:3",
      "clicked",
      "revoked:blob:test",
    ]);
  });
});
