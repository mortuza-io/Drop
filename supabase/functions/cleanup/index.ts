import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH = 200;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const provided = req.headers.get("x-cleanup-secret") ?? "";
    const { data: secret, error: secretError } = await db
      .from("internal_config")
      .select("value")
      .eq("key", "cleanup_secret")
      .maybeSingle();
    if (secretError) throw secretError;
    if (!secret || !provided || !safeEqual(provided, secret.value)) return json({ error: "Not allowed." }, 403);

    const { data: due, error } = await db.rpc("files_due_for_cleanup", { p_limit: BATCH });
    if (error) throw error;
    const rows = (due ?? []) as { id: string; storage_path: string; storage_backend: string }[];

    const accountId = Deno.env.get("R2_ACCOUNT_ID");
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const bucket = Deno.env.get("R2_BUCKET_NAME");
    const r2 = accountId && accessKeyId && secretAccessKey && bucket
      ? new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" })
      : null;

    const removed: string[] = [];

    const legacy = rows.filter((r) => r.storage_backend === "supabase");
    if (legacy.length) {
      const { error: rmError } = await db.storage.from("uploads").remove(legacy.map((r) => r.storage_path));
      if (rmError) console.error("legacy storage cleanup failed", rmError);
      else removed.push(...legacy.map((r) => r.id));
    }

    if (r2) {
      await Promise.all(
        rows
          .filter((r) => r.storage_backend === "r2")
          .map(async (r) => {
            const key = r.storage_path.split("/").map(encodeURIComponent).join("/");
            const res = await r2.fetch(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`, { method: "DELETE" });
            if (res.ok || res.status === 404) removed.push(r.id);
            else console.error("r2 delete failed", r.id, res.status);
          }),
      );
    }

    if (removed.length) {
      const { error: delError } = await db.from("files").delete().in("id", removed);
      if (delError) throw delError;
    }

    return json({ checked: rows.length, deleted: removed.length });
  } catch (err) {
    console.error("cleanup error", err);
    return json({ error: "Cleanup failed." }, 500);
  }
});
