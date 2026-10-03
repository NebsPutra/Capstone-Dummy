import { describe, expect, it } from "vitest";
import { pushPayload } from "./push";

describe("pushPayload", () => {
  it("uses the notification text in the device's language and keeps links on-site", () => {
    const n = { id: "n1", user_id: "u1", type: "event_reminder", params: { title: "Run", time: "06:00", place: "GBK" }, link: "/activities/a1" };
    expect(pushPayload(n, "en")).toMatchObject({ body: "Coming up: Run starts at 06:00 at GBK.", url: "/activities/a1", tag: "n1" });
    expect(pushPayload(n, "id").body).toBe("Segera: Run mulai pukul 06:00 di GBK.");
    expect(pushPayload({ ...n, link: "https://evil.example" }, "en").url).toBe("/notifications");
  });
});
