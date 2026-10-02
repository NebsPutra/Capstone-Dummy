import { describe, it, expect } from "vitest";
import { notificationEmail } from "./notificationEmail";

describe("notificationEmail", () => {
  const origin = "https://komunitasa.vercel.app";

  it("builds a bilingual email for a new message, linking into the app", () => {
    const e = notificationEmail(
      { type: "new_message", params: { name: "Dika", username: "dika" }, link: "/messages/abc" },
      origin
    )!;
    expect(e.paragraphs).toEqual(["New message from Dika (@dika).", "Pesan baru dari Dika (@dika)."]);
    expect(e.action.href).toBe(`${origin}/messages/abc`);
  });

  it("skips types that aren't emailed", () => {
    expect(notificationEmail({ type: "security_alert" }, origin)).toBeNull();
  });

  it("never links off-site", () => {
    expect(notificationEmail({ type: "event_comment", link: "https://evil.example" }, origin)!.action.href).toBe(
      `${origin}/notifications`
    );
  });
});
