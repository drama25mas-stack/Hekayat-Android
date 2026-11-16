import { SignJWT, jwtVerify } from "jose";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const cors = (response, origin) => {
  const h = new Headers(response.headers);
  h.set("access-control-allow-origin", origin || "*");
  h.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  h.set("access-control-allow-headers", "content-type,authorization");
  h.set("vary", "Origin");
  return new Response(response.body, { status: response.status, headers: h });
};
const secretKey = (env) => new TextEncoder().encode(env.JWT_SECRET);
const supabase = (env, path, init = {}) => fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/" + path, {
  ...init,
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
    "content-type": "application/json",
    ...(init.headers || {})
  }
});
async function requireAdmin(request, env) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("UNAUTHORIZED");
  const { payload } = await jwtVerify(token, secretKey(env), { issuer: "hekayat-api", audience: "hekayat-admin" });
  if (payload.role !== "admin") throw new Error("UNAUTHORIZED");
  return payload;
}
const safeStory = (row) => ({
  id: row.id, title: row.title, description: row.description || "",
  category_id: row.category_id, cover_object_key: row.cover_object_key,
  duration_seconds: row.duration_seconds, status: row.status,
  published_at: row.published_at, created_at: row.created_at
});
async function handle(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (url.pathname === "/health") return json({ ok: true, service: "hekayat-api" });

  if (url.pathname === "/v1/admin/session" && request.method === "POST") {
    const body = await request.json();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(body.password || "")));
    const hex = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
    if (!body.email || body.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase() || hex !== env.ADMIN_PASSWORD_SHA256) {
      return json({ error: "بيانات الدخول غير صحيحة" }, 401);
    }
    const token = await new SignJWT({ role: "admin", email: env.ADMIN_EMAIL })
      .setProtectedHeader({ alg: "HS256" }).setIssuer("hekayat-api").setAudience("hekayat-admin")
      .setIssuedAt().setExpirationTime("8h").sign(secretKey(env));
    return json({ token, expires_in: 28800 });
  }

  if (url.pathname === "/v1/stories" && request.method === "GET") {
    const r = await supabase(env, "stories?select=id,title,description,category_id,video_object_key,cover_object_key,duration_seconds,status,published_at,created_at&status=eq.published&order=published_at.desc");
    if (!r.ok) return new Response(r.body, { status: r.status });
    const rows = await r.json();
    return json(rows.map(row => ({ ...row,
      video_url: url.origin + "/v1/media/" + encodeURIComponent(row.video_object_key),
      cover_url: row.cover_object_key ? url.origin + "/v1/media/" + encodeURIComponent(row.cover_object_key) : null
    })));
  }
  if (url.pathname === "/v1/categories" && request.method === "GET") {
    const r = await supabase(env, "categories?select=id,name,sort_order&order=sort_order.asc,name.asc");
    return new Response(r.body, { status: r.status, headers: { "content-type": "application/json" } });
  }
  if (url.pathname === "/v1/views" && request.method === "POST") {
    const body = await request.json();
    if (!body.story_id) return json({ error: "story_id is required" }, 400);
    const visible = await supabase(env, "stories?select=id&status=eq.published&id=eq." + encodeURIComponent(body.story_id));
    if (!visible.ok) return json({ error: "Story lookup failed" }, 502);
    const matches = await visible.json();
    if (!matches.length) return json({ error: "Story not found" }, 404);
    const saved = await supabase(env, "story_views", { method: "POST", body: JSON.stringify({ story_id: body.story_id }) });
    return json({ recorded: saved.ok }, saved.ok ? 201 : 502);
  }
  if (url.pathname.startsWith("/v1/media/") && request.method === "GET") {
    const key = decodeURIComponent(url.pathname.slice("/v1/media/".length));
    const check = await supabase(env, "stories?select=id&status=eq.published&video_object_key=eq." + encodeURIComponent(key));
    if (!check.ok) return json({ error: "Media lookup failed" }, 502);
    const rows = await check.json();
    if (!rows.length) return json({ error: "Media not found" }, 404);
    let object;
    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      const rawRange = rangeHeader.startsWith("bytes=") ? rangeHeader.slice(6) : "";
      const dash = rawRange.indexOf("-");
      const startText = rawRange.slice(0, dash);
      const endText = rawRange.slice(dash + 1);
      const digits = value => value.length > 0 && [...value].every(ch => ch >= "0" && ch <= "9");
      if (dash < 1 || !digits(startText) || (endText && !digits(endText))) return new Response(null, { status: 416 });
      const offset = Number(startText);
      const end = endText ? Number(endText) : undefined;
      object = await env.MEDIA.get(key, { range: end === undefined ? { offset } : { offset, length: end - offset + 1 } });
    } else object = await env.MEDIA.get(key);
    if (!object) return json({ error: "Media not found" }, 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("accept-ranges", "bytes");
    headers.set("cache-control", "public, max-age=3600");
    headers.set("etag", object.httpEtag);
    if (rangeHeader && object.range) {
      headers.set("content-range", "bytes " + object.range.offset + "-" + (object.range.offset + object.range.length - 1) + "/" + object.size);
      headers.set("content-length", String(object.range.length));
      return new Response(object.body, { status: 206, headers });
    }
    headers.set("content-length", String(object.size));
    return new Response(object.body, { headers });
  }

  if (url.pathname.startsWith("/v1/admin/")) await requireAdmin(request, env);

  if (url.pathname === "/v1/admin/stories" && request.method === "GET") {
    const [r, vr] = await Promise.all([
      supabase(env, "stories?select=*&order=created_at.desc"),
      supabase(env, "story_views?select=story_id")
    ]);
    if (!r.ok) return new Response(r.body, { status: r.status });
    const rows = await r.json();
    const viewRows = vr.ok ? await vr.json() : [];
    const counts = viewRows.reduce((acc, item) => { acc[item.story_id] = (acc[item.story_id] || 0) + 1; return acc; }, {});
    return json(rows.map(item => ({ ...item, views_count: counts[item.id] || 0 })));
  }
  if (url.pathname === "/v1/admin/stories" && request.method === "POST") {
    const body = await request.json();
    if (!body.title?.trim() || !body.video_object_key) return json({ error: "العنوان والفيديو مطلوبان" }, 400);
    const row = { title: body.title.trim(), description: body.description || null, category_id: body.category_id || null,
      video_object_key: body.video_object_key, cover_object_key: body.cover_object_key || null,
      mime_type: body.mime_type || "video/mp4", file_size_bytes: body.file_size_bytes || null,
      status: body.status === "published" ? "published" : "draft",
      published_at: body.status === "published" ? new Date().toISOString() : null };
    const r = await supabase(env, "stories", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify(row) });
    return new Response(r.body, { status: r.status, headers: { "content-type": "application/json" } });
  }
  const storyMatch = url.pathname.match(/^\/v1\/admin\/stories\/([0-9a-f-]+)$/i);
  if (storyMatch && request.method === "PATCH") {
    const b = await request.json();
    const row = {};
    for (const k of ["title","description","category_id","cover_object_key","video_object_key","file_size_bytes","mime_type","status"]) if (k in b) row[k] = b[k];
    if (b.status === "published") row.published_at = new Date().toISOString();
    const r = await supabase(env, "stories?id=eq." + storyMatch[1], { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify(row) });
    return new Response(r.body, { status: r.status, headers: { "content-type": "application/json" } });
  }
  if (storyMatch && request.method === "DELETE") {
    const found = await supabase(env, "stories?id=eq." + storyMatch[1] + "&select=video_object_key,cover_object_key");
    const rows = await found.json();
    const r = await supabase(env, "stories?id=eq." + storyMatch[1], { method: "DELETE" });
    if (r.ok && rows[0]?.video_object_key) await env.MEDIA.delete(rows[0].video_object_key);
    if (r.ok && rows[0]?.cover_object_key) await env.MEDIA.delete(rows[0].cover_object_key);
    return json({ ok: r.ok }, r.ok ? 200 : r.status);
  }

  if (url.pathname === "/v1/admin/categories" && request.method === "GET") {
    const r = await supabase(env, "categories?select=*&order=sort_order.asc,name.asc");
    return new Response(r.body, { status: r.status, headers: { "content-type": "application/json" } });
  }
  const categoryEditPrefix = "/v1/admin/categories/";
  if (url.pathname.startsWith(categoryEditPrefix) && request.method === "PATCH") {
    const categoryId = url.pathname.slice(categoryEditPrefix.length);
    if (!categoryId || categoryId.includes("/")) return json({ error: "Invalid category id" }, 400);
    const b = await request.json();
    const row = {};
    if (typeof b.name === "string" && b.name.trim()) row.name = b.name.trim();
    if (Number.isInteger(b.sort_order)) row.sort_order = b.sort_order;
    const r = await supabase(env, "categories?id=eq." + categoryId, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify(row) });
    return new Response(r.body, { status: r.status, headers: { "content-type": "application/json" } });
  }
  if (url.pathname === "/v1/admin/categories" && request.method === "POST") {
    const b = await request.json();
    if (!b.name?.trim()) return json({ error: "اسم التصنيف مطلوب" }, 400);
    const r = await supabase(env, "categories", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify({ name: b.name.trim(), sort_order: Number(b.sort_order || 0) }) });
    return new Response(r.body, { status: r.status, headers: { "content-type": "application/json" } });
  }
  const categoryMatch = url.pathname.match(/^\/v1\/admin\/categories\/([0-9a-f-]+)$/i);
  if (categoryMatch && request.method === "DELETE") {
    const r = await supabase(env, "categories?id=eq." + categoryMatch[1], { method: "DELETE" });
    return json({ ok: r.ok }, r.ok ? 200 : r.status);
  }

  if (url.pathname === "/v1/admin/stats" && request.method === "GET") {
    const r = await supabase(env, "stories?select=id,status,created_at,published_at");
    if (!r.ok) return new Response(r.body, { status: r.status });
    const rows = await r.json();
    const views = await supabase(env, "story_views?select=id");
    const viewRows = views.ok ? await views.json() : [];
    const counts = viewRows.reduce((acc, item) => { acc[item.story_id] = (acc[item.story_id] || 0) + 1; return acc; }, {});
    const topStories = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,5).map(([id,count]) => ({ id, views: count }));
    return json({ stories: rows.length, published: rows.filter(x => x.status === "published").length,
      drafts: rows.filter(x => x.status === "draft").length, views: viewRows.length, top_stories: topStories });
  }

  if (url.pathname === "/v1/admin/uploads" && request.method === "POST") {
    const b = await request.json();
    const name = String(b.filename || "video").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
    const key = "stories/" + crypto.randomUUID() + "-" + name;
    const upload = await env.MEDIA.createMultipartUpload(key, {
      httpMetadata: { contentType: b.content_type || "application/octet-stream" }
    });
    return json({ object_key: key, upload_id: upload.uploadId, part_size: 8 * 1024 * 1024 });
  }
  const partPrefix = "/v1/admin/uploads/parts/";
  if (url.pathname.startsWith(partPrefix) && request.method === "PUT") {
    const tail = url.pathname.slice(partPrefix.length);
    const splitAt = tail.lastIndexOf("/");
    if (splitAt < 1) return json({ error: "Invalid upload part path" }, 400);
    const key = decodeURIComponent(tail.slice(0, splitAt));
    const partNumber = Number(tail.slice(splitAt + 1));
    const uploadId = url.searchParams.get("upload_id");
    if (!uploadId || !Number.isInteger(partNumber) || partNumber < 1) return json({ error: "Invalid multipart upload details" }, 400);
    const upload = env.MEDIA.resumeMultipartUpload(key, uploadId);
    const part = await upload.uploadPart(partNumber, await request.arrayBuffer());
    return json({ part_number: partNumber, etag: part.etag });
  }
  if (url.pathname === "/v1/admin/uploads/complete" && request.method === "POST") {
    const b = await request.json();
    if (!b.object_key || !b.upload_id || !Array.isArray(b.parts) || !b.parts.length) return json({ error: "Invalid completion details" }, 400);
    const upload = env.MEDIA.resumeMultipartUpload(b.object_key, b.upload_id);
    const result = await upload.complete(b.parts);
    return json({ object_key: result.key });
  }
