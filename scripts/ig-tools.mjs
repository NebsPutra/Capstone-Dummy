// Instagram helpers for komunitasa.id (Instagram API with Instagram Login).
// Usage: node --env-file=.env.local scripts/ig-tools.mjs <command>
//   refresh                  extend IG_ACCESS_TOKEN by 60 days and save it back to .env.local
//   comments [hours=24]      list comments on recent posts newer than <hours> as JSON
//   reply <comment-id> <text>  reply to a comment (only after the user approved the text)
import { readFileSync, writeFileSync } from "node:fs";

const API = "https://graph.instagram.com/v23.0";
const { IG_ACCESS_TOKEN } = process.env;
const [cmd, ...args] = process.argv.slice(2);

async function ig(path, params = {}, method = "GET") {
  const body = new URLSearchParams({ ...params, access_token: IG_ACCESS_TOKEN });
  const res = method === "GET" ? await fetch(`${API}/${path}?${body}`) : await fetch(`${API}/${path}`, { method, body });
  const json = await res.json();
  if (json.error) throw new Error(`Instagram: ${json.error.message}`);
  return json;
}

if (cmd === "refresh") {
  // Fails if the token is less than 24h old; that's fine, it is still valid.
  const res = await fetch(`https://graph.instagram.com/refresh_access_token?${new URLSearchParams({ grant_type: "ig_refresh_token", access_token: IG_ACCESS_TOKEN })}`);
  const json = await res.json();
  if (json.error) {
    console.log(`Token not refreshed: ${json.error.message}`);
  } else {
    const env = readFileSync(".env.local", "utf8").replace(/^IG_ACCESS_TOKEN=.*$/m, `IG_ACCESS_TOKEN=${json.access_token}`);
    writeFileSync(".env.local", env);
    console.log(`Token refreshed, valid for ${Math.round(json.expires_in / 86400)} more days`);
  }
} else if (cmd === "comments") {
  const since = Date.now() - Number(args[0] ?? 24) * 3600_000;
  const { username } = await ig("me", { fields: "username" });
  const { data: media } = await ig("me/media", { fields: "id,caption,permalink", limit: "10" });
  const out = [];
  for (const m of media) {
    const { data: comments } = await ig(`${m.id}/comments`, { fields: "id,text,username,timestamp,replies{username}" });
    for (const c of comments) {
      if (c.username === username || Date.parse(c.timestamp) < since) continue;
      const answered = c.replies?.data?.some((r) => r.username === username) ?? false;
      out.push({ id: c.id, from: c.username, text: c.text, at: c.timestamp, answered, post: m.permalink });
    }
  }
  console.log(JSON.stringify(out, null, 2));
} else if (cmd === "reply" && args[0] && args[1]) {
  const { id } = await ig(`${args[0]}/replies`, { message: args[1] }, "POST");
  console.log(`Replied: ${id}`);
} else {
  console.error("Usage: scripts/ig-tools.mjs refresh | comments [hours] | reply <comment-id> <text>");
  process.exit(1);
}
