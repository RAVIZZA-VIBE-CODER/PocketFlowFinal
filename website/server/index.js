const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SESSION_SECONDS = 8 * 60 * 60;
const ALLOWED_UPLOAD_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function clean(value, maxLength = 2000) {
  return String(value || "").trim().slice(0, maxLength);
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.get("cookie") || "").split(";").map((part) => {
    const [name, ...value] = part.trim().split("=");
    return [name, value.join("=")];
  }).filter(([name]) => name));
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(value, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

async function sameSecret(left, right) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(String(left || ""))),
    crypto.subtle.digest("SHA-256", encoder.encode(String(right || ""))),
  ]);
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  let difference = 0;
  for (let index = 0; index < av.length; index += 1) difference |= av[index] ^ bv[index];
  return difference === 0;
}

async function createSession(username, secret) {
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({
    sub: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  })));
  return `${payload}.${await hmac(payload, secret)}`;
}

async function readSession(request, env) {
  if (!env.ADMIN_SESSION_SECRET) return null;
  const token = parseCookies(request).pocketflow_admin;
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !(await sameSecret(signature, await hmac(payload, env.ADMIN_SESSION_SECRET)))) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(base64));
    return decoded.exp > Math.floor(Date.now() / 1000) ? decoded : null;
  } catch {
    return null;
  }
}

function requireBindings(env, names) {
  const missing = names.filter((name) => !env[name]);
  return missing.length ? json({ error: "Backend not configured", missing }, 503) : null;
}

async function login(request, env) {
  const missing = requireBindings(env, ["ADMIN_USERNAME", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET"]);
  if (missing) return missing;
  const body = await request.json().catch(() => ({}));
  const validUser = await sameSecret(clean(body.username, 100), env.ADMIN_USERNAME);
  const validPassword = await sameSecret(body.password, env.ADMIN_PASSWORD);
  if (!validUser || !validPassword) return json({ error: "Invalid credentials" }, 401);
  const token = await createSession(env.ADMIN_USERNAME, env.ADMIN_SESSION_SECRET);
  return json({ authenticated: true }, 200, {
    "set-cookie": `pocketflow_admin=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=${SESSION_SECONDS}`,
  });
}

async function publicCampaigns(env) {
  const missing = requireBindings(env, ["COMMUNITY_DB"]);
  if (missing) return missing;
  const result = await env.COMMUNITY_DB.prepare(
    "SELECT id, type, title, summary, closes_at AS closesAt, questions_json AS questions FROM campaigns WHERE status = 'published' AND (closes_at IS NULL OR closes_at > datetime('now')) ORDER BY created_at DESC",
  ).all();
  return json({ campaigns: result.results.map((campaign) => ({ ...campaign, questions: JSON.parse(campaign.questions || "[]") })) });
}

async function submitProject(request, env) {
  const missing = requireBindings(env, ["COMMUNITY_DB", "COMMUNITY_UPLOADS"]);
  if (missing) return missing;
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_UPLOAD_BYTES + 100_000) return json({ error: "Upload is too large" }, 413);

  const form = await request.formData();
  const name = clean(form.get("name"), 120);
  const email = clean(form.get("email"), 254).toLowerCase();
  const projectName = clean(form.get("projectName"), 100);
  const githubUrl = clean(form.get("githubUrl"), 500);
  const description = clean(form.get("description"));
  const consent = form.get("consent") === "on" || form.get("consent") === "true";
  const attachment = form.get("attachment");

  let repository;
  try {
    repository = new URL(githubUrl);
  } catch {
    return json({ error: "A valid GitHub repository URL is required" }, 400);
  }
  if (!name || !email.includes("@") || !projectName || !description || !consent || repository.hostname !== "github.com" || repository.pathname.split("/").filter(Boolean).length < 2) {
    return json({ error: "Required submission fields are missing or invalid" }, 400);
  }

  const id = crypto.randomUUID();
  let attachmentKey = null;
  if (attachment instanceof File && attachment.size > 0) {
    if (attachment.size > MAX_UPLOAD_BYTES || !ALLOWED_UPLOAD_TYPES.has(attachment.type)) return json({ error: "Unsupported attachment or file exceeds 10 MB" }, 400);
    const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-140);
    attachmentKey = `contest/${id}/${safeName}`;
    await env.COMMUNITY_UPLOADS.put(attachmentKey, attachment.stream(), {
      httpMetadata: { contentType: attachment.type },
      customMetadata: { submissionId: id },
    });
  }

  try {
    await env.COMMUNITY_DB.prepare(
      "INSERT INTO contest_submissions (id, name, email, project_name, github_url, description, attachment_key, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'new')",
    ).bind(id, name, email, projectName, githubUrl, description, attachmentKey).run();
  } catch (error) {
    if (attachmentKey) await env.COMMUNITY_UPLOADS.delete(attachmentKey);
    throw error;
  }
  return json({ id, received: true }, 201);
}

async function submitCampaignResponse(request, env) {
  const missing = requireBindings(env, ["COMMUNITY_DB"]);
  if (missing) return missing;
  const body = await request.json().catch(() => ({}));
  const campaignId = clean(body.campaignId, 80);
  const name = clean(body.name, 120);
  const email = clean(body.email, 254).toLowerCase();
  const answers = body.answers && typeof body.answers === "object" ? body.answers : null;
  if (!campaignId || !name || !email.includes("@") || !answers) return json({ error: "Invalid response" }, 400);
  const campaign = await env.COMMUNITY_DB.prepare("SELECT id FROM campaigns WHERE id = ? AND status = 'published'").bind(campaignId).first();
  if (!campaign) return json({ error: "Campaign is not open" }, 404);
  const id = crypto.randomUUID();
  await env.COMMUNITY_DB.prepare(
    "INSERT INTO campaign_responses (id, campaign_id, name, email, answers_json) VALUES (?, ?, ?, ?, ?)",
  ).bind(id, campaignId, name, email, JSON.stringify(answers).slice(0, 20_000)).run();
  return json({ id, received: true }, 201);
}

async function adminCampaigns(request, env) {
  const missing = requireBindings(env, ["COMMUNITY_DB"]);
  if (missing) return missing;
  if (request.method === "GET") {
    const result = await env.COMMUNITY_DB.prepare("SELECT * FROM campaigns ORDER BY created_at DESC").all();
    return json({ campaigns: result.results });
  }
  const body = await request.json().catch(() => ({}));
  const type = ["survey", "event", "contest"].includes(body.type) ? body.type : "survey";
  const status = body.status === "published" ? "published" : "draft";
  const title = clean(body.title, 120);
  const summary = clean(body.summary, 800);
  const closesAt = clean(body.closesAt, 40) || null;
  const questions = clean(body.questions, 4000).split("\n").map((question) => question.trim()).filter(Boolean).slice(0, 30);
  if (!title || !summary) return json({ error: "Title and summary are required" }, 400);
  const id = crypto.randomUUID();
  await env.COMMUNITY_DB.prepare(
    "INSERT INTO campaigns (id, type, title, summary, questions_json, closes_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(id, type, title, summary, JSON.stringify(questions), closesAt, status).run();
  return json({ id, created: true }, 201);
}

async function adminEntries(env) {
  const missing = requireBindings(env, ["COMMUNITY_DB"]);
  if (missing) return missing;
  const [submissions, responses] = await Promise.all([
    env.COMMUNITY_DB.prepare("SELECT id, name, email, project_name AS projectName, github_url AS githubUrl, description, attachment_key AS attachmentKey, status, created_at AS createdAt FROM contest_submissions ORDER BY created_at DESC").all(),
    env.COMMUNITY_DB.prepare("SELECT id, campaign_id AS campaignId, name, email, answers_json AS answers, created_at AS createdAt FROM campaign_responses ORDER BY created_at DESC").all(),
  ]);
  return json({ submissions: submissions.results, responses: responses.results });
}

async function api(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return json({ error: "Cross-origin request rejected" }, 403);

  if (url.pathname === "/api/community/campaigns" && request.method === "GET") return publicCampaigns(env);
  if (url.pathname === "/api/community/submissions" && request.method === "POST") return submitProject(request, env);
  if (url.pathname === "/api/community/responses" && request.method === "POST") return submitCampaignResponse(request, env);
  if (url.pathname === "/api/admin/login" && request.method === "POST") return login(request, env);

  if (url.pathname.startsWith("/api/admin/")) {
    const session = await readSession(request, env);
    if (!session) return json({ authenticated: false }, 401);
    if (url.pathname === "/api/admin/session" && request.method === "GET") return json({ authenticated: true, user: session.sub });
    if (url.pathname === "/api/admin/campaigns" && ["GET", "POST"].includes(request.method)) return adminCampaigns(request, env);
    if (url.pathname === "/api/admin/entries" && request.method === "GET") return adminEntries(env);
    if (url.pathname === "/api/admin/logout" && request.method === "POST") {
      return json({ authenticated: false }, 200, { "set-cookie": "pocketflow_admin=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0" });
    }
  }

  return json({ error: "API route not found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await api(request, env);
      } catch {
        return json({ error: "Unexpected backend error" }, 500);
      }
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== "GET") return response;

    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (!acceptsHtml) return response;

    const indexUrl = new URL("/index.html", request.url);
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};
