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

  it("emails friend and join requests", () => {
    expect(notificationEmail({ type: "friend_request", params: { name: "Dika", username: "dika" } }, origin)!.paragraphs[0]).toBe(
      "Dika (@dika) sent you a friend request."
    );
    expect(notificationEmail({ type: "join_request", params: { title: "Morning Run" } }, origin)!.paragraphs[0]).toBe(
      "New join request for Morning Run."
    );
  });

  it("emails players when the activity from their Find players request is created", () => {
    const e = notificationEmail({ type: "play_request_ready", params: { title: "Badminton doubles" }, link: "/activities/abc" }, origin)!;
    expect(e.paragraphs[0]).toBe("Badminton doubles: the activity is on! Tap to join.");
    expect(e.action.href).toBe(`${origin}/activities/abc`);
  });

  it("emails an announcement with the admin's text and its own opt-out footer", () => {
    const e = notificationEmail(
      { type: "announcement", params: { title: "Plan your weekend", body: "Create an activity.\n\nBuat aktivitas." }, link: "/create" },
      origin
    )!;
    expect(e.subject).toBe("Plan your weekend");
    expect(e.paragraphs).toEqual(["Create an activity.", "Buat aktivitas."]);
    expect(e.action.href).toBe(`${origin}/create`);
    expect(e.footer).toContain("News and tips");
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
