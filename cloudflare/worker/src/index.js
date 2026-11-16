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
    const r = await supabase(env, "stories?select=id,title,description,category_id,cover_object_key,duration_seconds,status,published_at,created_at&status=eq.published&order=published_at.desc");
    return new Response(r.body, { status: r.status, headers: { "content-type": "application/json" } });
  }

  if (url.pathname.startsWith("/v1/admin/")) await requireAdmin(request, env);

  if (url.pathname === "/v1/admin/stories" && request.method === "GET") {
    const r = await supabase(env, "stories?select=*&order=created_at.desc");
    return new Response(r.body, { status: r.status, headers: { "content-type": "application/json" } });
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
    for (const k of ["title","description","category_id","cover_object_key","status"]) if (k in b) row[k] = b[k];
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
    return json({ stories: rows.length, published: rows.filter(x => x.status === "published").length,
      drafts: rows.filter(x => x.status === "draft").length, views: viewRows.length });
  }

  if (url.pathname === "/v1/admin/uploads" && request.method === "POST") {
    const b = await request.json();
    const name = String(b.filename || "video").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
    const key = "stories/" + crypto.randomUUID() + "-" + name;
    return json({ upload_url: "/v1/admin/uploads/" + encodeURIComponent(key), object_key: key });
  }
  const uploadMatch = url.pathname.match(/^\/v1\/admin\/uploads\/(.+)$/);
  if (uploadMatch && request.method === "PUT") {
    const key = decodeURIComponent(uploadMatch[1]);
    const size = Number(request.headers.get("content-length") || 0);
    if (size > 95 * 1024 * 1024) return json({ error: "حجم الملف أكبر من حد الرفع المباشر؛ نحتاج تفعيل الرفع المجزأ للفيديوهات الكبيرة." }, 413);
    await env.MEDIA.put(key, request.body, { httpMetadata: { contentType: request.headers.get("content-type") || "application/octet-stream" } });
    return json({ object_key: key });
  }

  return json({ error: "Not found" }, 404);
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "*";
    try {
      const url = new URL(request.url);
      let response;
      if (!url.pathname.startsWith("/v1/") && url.pathname !== "/health") response = await env.ASSETS.fetch(request);
      else response = await handle(request, env);
      return cors(response, origin);
    } catch (e) {
      const status = e.message === "UNAUTHORIZED" ? 401 : 500;
      return cors(json({ error: status === 401 ? "غير مصرح" : "حدث خطأ في الخادم" }, status), origin);
    }
  }
};
