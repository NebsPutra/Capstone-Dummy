// Publish one file to Instagram (komunitasa.id) via the Instagram API with Instagram Login.
// Usage: node --env-file=.env.local scripts/ig-post.mjs <post|story|reel> <file> [caption text or caption file]
// The API only fetches media from a public URL, so the file goes to the public Supabase bucket
// "instagram" first and is removed again once Instagram has its copy.
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, extname } from "node:path";
import { tmpdir } from "node:os";
import { createClient } from "@supabase/supabase-js";

const API = "https://graph.instagram.com/v23.0";
const { IG_USER_ID, IG_ACCESS_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const [type, file, captionArg = ""] = process.argv.slice(2);

if (!["post", "story", "reel"].includes(type) || !file || !existsSync(file)) {
  console.error("Usage: node --env-file=.env.local scripts/ig-post.mjs <post|story|reel> <file> [caption]");
  process.exit(1);
}
if (!IG_USER_ID || !IG_ACCESS_TOKEN || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing IG_USER_ID, IG_ACCESS_TOKEN or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const caption = existsSync(captionArg) ? readFileSync(captionArg, "utf8").trim() : captionArg;
const isVideo = [".mp4", ".mov"].includes(extname(file).toLowerCase());

async function ig(path, params = {}, method = "GET") {
  const body = new URLSearchParams({ ...params, access_token: IG_ACCESS_TOKEN });
  const res = method === "GET" ? await fetch(`${API}/${path}?${body}`) : await fetch(`${API}/${path}`, { method, body });
  const json = await res.json();
  if (json.error) throw new Error(`Instagram: ${json.error.message}`);
  return json;
}

// Instagram only accepts JPEG stills.
let upload = file;
if (!isVideo && extname(file).toLowerCase() !== ".jpg") {
  upload = `${tmpdir()}/ig-${Date.now()}.jpg`;
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "92", file, "--out", upload], { stdio: "ignore" });
}

const sb = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
await sb.storage.createBucket("instagram", { public: true }); // errors harmlessly if it already exists
const path = `${Date.now()}-${basename(upload)}`;
const { error: upErr } = await sb.storage
  .from("instagram")
  .upload(path, readFileSync(upload), { contentType: isVideo ? "video/mp4" : "image/jpeg" });
if (upErr) throw upErr;
const url = sb.storage.from("instagram").getPublicUrl(path).data.publicUrl;

try {
  const params = { [isVideo ? "video_url" : "image_url"]: url };
  if (type === "reel") params.media_type = "REELS";
  if (type === "story") params.media_type = "STORIES";
  if (caption && type !== "story") params.caption = caption; // stories have no caption

  const { id: container } = await ig(`${IG_USER_ID}/media`, params, "POST");

  // Videos need processing time; images are usually ready at once.
  for (let i = 0; i < 60; i++) {
    const { status_code } = await ig(container, { fields: "status_code" });
    if (status_code === "FINISHED") break;
    if (status_code === "ERROR" || status_code === "EXPIRED") throw new Error(`Instagram processing ${status_code}`);
    await new Promise((r) => setTimeout(r, 5000));
  }

  const { id } = await ig(`${IG_USER_ID}/media_publish`, { creation_id: container }, "POST");
  const { permalink } = await ig(id, { fields: "permalink" });
  console.log(`Published ${type}: ${permalink ?? id}`);
} finally {
  await sb.storage.from("instagram").remove([path]);
}
