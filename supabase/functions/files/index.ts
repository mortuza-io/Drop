import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_HOURS = 90 * 24;
const MAX_DOWNLOAD_LIMIT = 1000;
const MAX_PASSWORD_ATTEMPTS = 10;
const LOCK_MINUTES = 15;
const UPLOAD_URL_TTL = 3600;
const DOWNLOAD_URL_TTL = 300;
const CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

const PUBLIC_COLUMNS =
  "download_code, filename, file_size, mime_type, expires_at, max_downloads, download_count, password_hash, created_at";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function r2() {
  const accountId = Deno.env.get("R2_ACCOUNT_ID");
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const bucket = Deno.env.get("R2_BUCKET_NAME");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new HttpError(503, "File storage is not set up yet.");
  }
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  const objectUrl = (key: string) =>
    new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`);
  return { client, objectUrl };
}

async function presign(method: string, url: URL, ttl: number) {
  const { client } = r2();
  url.searchParams.set("X-Amz-Expires", String(ttl));
  const signed = await client.sign(url.toString(), { method, aws: { signQuery: true } });
  return signed.url;
}

function randomCode(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
const toB64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function sha256Hex(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100_000;
  return `pbkdf2$${iterations}$${toB64(salt)}$${toB64(await pbkdf2(password, salt, iterations))}`;
}

async function verifyPassword(password: string, stored: string) {
  if (stored.startsWith("pbkdf2$")) {
    const [, iter, salt, hash] = stored.split("$");
    return safeEqual(toB64(await pbkdf2(password, fromB64(salt), Number(iter))), hash);
  }
  return safeEqual(await sha256Hex(password), stored);
}

function publicView(row: Record<string, unknown>) {
  return {
    download_code: row.download_code,
    filename: row.filename,
    file_size: row.file_size,
    mime_type: row.mime_type,
    expires_at: row.expires_at,
    max_downloads: row.max_downloads,
    download_count: row.download_count,
    created_at: row.created_at,
    has_password: !!row.password_hash,
  };
}

function asCode(v: unknown) {
  if (typeof v !== "string" || !/^[a-z0-9]{6,16}$/.test(v)) throw new HttpError(404, "File not found.");
  return v;
}

function asToken(v: unknown) {
  if (typeof v !== "string" || v.length < 20 || v.length > 100) throw new HttpError(403, "Not allowed.");
  return v;
}

function cleanFilename(v: unknown) {
  if (typeof v !== "string") throw new HttpError(400, "Invalid file name.");
  const name = v.replace(/[\p{Cc}/\\]+/gu, "_").trim().slice(-200);
  if (!name) throw new HttpError(400, "Invalid file name.");
  return name;
}

async function loadOwned(code: string, token: string) {
  const { data, error } = await db
    .from("files")
    .select(`id, storage_path, storage_backend, owner_token_hash, uploaded_at, ${PUBLIC_COLUMNS}`)
    .eq("download_code", code)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.owner_token_hash || !safeEqual(await sha256Hex(token), data.owner_token_hash)) {
    throw new HttpError(404, "File not found.");
  }
  return data;
}

async function removeObject(path: string, backend: string) {
  if (backend === "supabase") {
    await db.storage.from("uploads").remove([path]);
    return;
  }
  const { client, objectUrl } = r2();
  const res = await client.fetch(objectUrl(path).toString(), { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed: ${res.status}`);
}

async function create(body: Record<string, unknown>) {
  const filename = cleanFilename(body.filename);
  const size = Number(body.size);
  if (!Number.isInteger(size) || size < 1 || size > MAX_FILE_SIZE) throw new HttpError(400, "Files must be between 1 byte and 100 MB.");
  const hours = Number(body.expiresInHours);
  if (!Number.isFinite(hours) || hours < 1 || hours > MAX_HOURS) throw new HttpError(400, "Files can stay for 1 hour up to 90 days.");
  const maxDownloads = body.maxDownloads === null || body.maxDownloads === undefined ? null : Number(body.maxDownloads);
  if (maxDownloads !== null && (!Number.isInteger(maxDownloads) || maxDownloads < 1 || maxDownloads > MAX_DOWNLOAD_LIMIT)) {
    throw new HttpError(400, "Invalid download limit.");
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length > 128) throw new HttpError(400, "Password is too long.");
  const mime = typeof body.mimeType === "string" && /^[\w.+-]+\/[\w.+-]+$/.test(body.mimeType) ? body.mimeType.slice(0, 100) : "application/octet-stream";

  const code = randomCode(10);
  const ownerToken = toB64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]!);
  const storagePath = `${code}/${crypto.randomUUID()}`;
  const uploadUrl = await presign("PUT", r2().objectUrl(storagePath), UPLOAD_URL_TTL);

  const { error } = await db.from("files").insert({
    filename,
    storage_path: storagePath,
    storage_backend: "r2",
    file_size: size,
    mime_type: mime,
    download_code: code,
    max_downloads: maxDownloads,
    expires_at: new Date(Date.now() + Math.round(hours) * 3600_000).toISOString(),
    password_hash: password ? await hashPassword(password) : null,
    owner_token_hash: await sha256Hex(ownerToken),
  });
  if (error) throw error;

  return { code, ownerToken, uploadUrl };
}

async function finalize(body: Record<string, unknown>) {
  const row = await loadOwned(asCode(body.code), asToken(body.ownerToken));
  if (!row.uploaded_at) {
    const { client, objectUrl } = r2();
    const head = await client.fetch(objectUrl(row.storage_path).toString(), { method: "HEAD" });
    const actual = Number(head.headers.get("content-length"));
    if (!head.ok || !actual || actual > MAX_FILE_SIZE || actual !== Number(row.file_size)) {
      await removeObject(row.storage_path, "r2").catch(() => {});
      await db.from("files").delete().eq("id", row.id);
      throw new HttpError(400, "The upload did not complete correctly. Please try again.");
    }
    const { error } = await db.from("files").update({ uploaded_at: new Date().toISOString() }).eq("id", row.id);
    if (error) throw error;
  }
  return publicView(row);
}

async function info(body: Record<string, unknown>) {
  const { data, error } = await db
    .from("files")
    .select(PUBLIC_COLUMNS)
    .eq("download_code", asCode(body.code))
    .not("uploaded_at", "is", null)
    .maybeSingle();
  if (error) throw error;
  if (!data || (data.expires_at && new Date(data.expires_at) < new Date())) throw new HttpError(404, "File not found.");
  return publicView(data);
}

async function download(body: Record<string, unknown>) {
  const code = asCode(body.code);
  const { data: row, error } = await db
    .from("files")
    .select("id, filename, storage_path, storage_backend, password_hash, failed_attempts, locked_until, uploaded_at, expires_at")
    .eq("download_code", code)
    .maybeSingle();
  if (error) throw error;
  if (!row || !row.uploaded_at) throw new HttpError(404, "File not found.");

  if (row.password_hash) {
    if (row.locked_until && new Date(row.locked_until) > new Date()) {
      throw new HttpError(429, "Too many wrong attempts. Try again in a few minutes.");
    }
    const password = typeof body.password === "string" ? body.password.slice(0, 128) : "";
    if (!password || !(await verifyPassword(password, row.password_hash))) {
      const attempts = (row.failed_attempts ?? 0) + 1;
      const locked = attempts >= MAX_PASSWORD_ATTEMPTS;
      await db
        .from("files")
        .update({
          failed_attempts: locked ? 0 : attempts,
          locked_until: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : row.locked_until,
        })
        .eq("id", row.id);
      throw new HttpError(locked ? 429 : 401, locked ? "Too many wrong attempts. Try again in a few minutes." : "That password is not correct.");
    }
    if (row.failed_attempts) await db.from("files").update({ failed_attempts: 0 }).eq("id", row.id);
  }

  const { data: count, error: claimError } = await db.rpc("claim_download", { p_code: code });
  if (claimError) throw claimError;
  if (count === null) throw new HttpError(410, "This file is no longer available.");

  let url: string;
  if (row.storage_backend === "supabase") {
    const { data, error: signError } = await db.storage.from("uploads").createSignedUrl(row.storage_path, DOWNLOAD_URL_TTL, { download: row.filename });
    if (signError || !data) throw signError ?? new Error("sign failed");
    url = data.signedUrl;
  } else {
    const target = r2().objectUrl(row.storage_path);
    target.searchParams.set("response-content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`);
    target.searchParams.set("response-content-type", "application/octet-stream");
    url = await presign("GET", target, DOWNLOAD_URL_TTL);
  }
  return { url, download_count: count };
}

async function list(body: Record<string, unknown>) {
  const items = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
  const results = await Promise.all(
    items.map(async (it: Record<string, unknown>) => {
      try {
        const row = await loadOwned(asCode(it?.code), asToken(it?.ownerToken));
        if (!row.uploaded_at) return null;
        return publicView(row);
      } catch (e) {
        if (e instanceof HttpError) return null;
        throw e;
      }
    }),
  );
  return { files: results.filter(Boolean) };
}

async function remove(body: Record<string, unknown>) {
  const row = await loadOwned(asCode(body.code), asToken(body.ownerToken));
  await removeObject(row.storage_path, row.storage_backend);
  const { error } = await db.from("files").delete().eq("id", row.id);
  if (error) throw error;
  return { deleted: true };
}

const actions: Record<string, (body: Record<string, unknown>) => Promise<unknown>> = {
  create,
  finalize,
  info,
  download,
  list,
  delete: remove,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    if (req.method !== "POST") throw new HttpError(405, "Method not allowed.");
    const body = await req.json().catch(() => null);
    const handler = body && typeof body.action === "string" ? actions[body.action] : undefined;
    if (!handler) throw new HttpError(400, "Unknown request.");
    return json(await handler(body));
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error("files function error", err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
