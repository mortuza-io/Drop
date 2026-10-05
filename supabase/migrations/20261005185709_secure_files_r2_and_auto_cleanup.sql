/*
# Secure file access, move new uploads to Cloudflare R2, and prepare automatic cleanup

## Plain-English summary
Until now the browser could read, change and delete any file record and any stored file directly.
After this change the browser has NO direct access. Every action (upload, download, list, delete)
goes through a server function that checks the rules: expiry, download limits, passwords and
ownership. New files are stored in Cloudflare R2; existing files stay in the old storage until they expire.

## 1. Modified table: `files`
- `owner_token_hash` (text) - SHA-256 of a secret token handed only to the uploader's browser; required to list/delete.
- `storage_backend` (text, default 'r2') - where the bytes live. Existing rows are marked 'supabase'.
- `uploaded_at` (timestamptz) - set once the server confirms the upload landed. Existing rows get their created_at.
- `last_download_at` (timestamptz) - time of the most recent download.
- `failed_attempts` (integer, default 0) - wrong password attempts in the current window.
- `locked_until` (timestamptz) - password entry is blocked until this time after too many wrong attempts.

## 2. New table: `internal_config`
- `key` (text, primary key), `value` (text). Holds a randomly generated secret the scheduled cleanup job
  presents to the cleanup function. Not readable by the browser.

## 3. New functions (server-only, not callable by browser roles)
- `claim_download(p_code)` - atomically counts a download only if the file is uploaded, not expired, and under its limit.
- `files_due_for_cleanup(p_limit)` - lists files that are expired, used up, or abandoned mid-upload.

## 4. Security
- All public policies on `files` are removed and all table privileges revoked from anon/authenticated (deny by default).
- RLS stays enabled on `files`; RLS enabled on `internal_config` with no policies.
- The old `uploads` storage bucket becomes private and its public upload/download/delete policies are removed.

## 5. Important notes
1. No data is deleted by this migration.
2. Rows are only reachable through server functions using the service role.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'storage_backend') THEN
    ALTER TABLE files ADD COLUMN storage_backend text NOT NULL DEFAULT 'supabase';
    ALTER TABLE files ALTER COLUMN storage_backend SET DEFAULT 'r2';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'uploaded_at') THEN
    ALTER TABLE files ADD COLUMN uploaded_at timestamptz;
    UPDATE files SET uploaded_at = COALESCE(created_at, now()) WHERE uploaded_at IS NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'owner_token_hash') THEN
    ALTER TABLE files ADD COLUMN owner_token_hash text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'last_download_at') THEN
    ALTER TABLE files ADD COLUMN last_download_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'failed_attempts') THEN
    ALTER TABLE files ADD COLUMN failed_attempts integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'locked_until') THEN
    ALTER TABLE files ADD COLUMN locked_until timestamptz;
  END IF;
END $$;

ALTER TABLE files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_files" ON files;
DROP POLICY IF EXISTS "anon_insert_files" ON files;
DROP POLICY IF EXISTS "anon_update_files" ON files;
DROP POLICY IF EXISTS "anon_delete_files" ON files;
REVOKE ALL ON files FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_files_uploaded_at ON files(uploaded_at);

CREATE TABLE IF NOT EXISTS internal_config (
  key text PRIMARY KEY,
  value text NOT NULL
);
ALTER TABLE internal_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON internal_config FROM anon, authenticated;
INSERT INTO internal_config (key, value)
VALUES ('cleanup_secret', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

UPDATE storage.buckets SET public = false WHERE id = 'uploads';
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes" ON storage.objects;

CREATE OR REPLACE FUNCTION claim_download(p_code text)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE files
  SET download_count = download_count + 1, last_download_at = now()
  WHERE download_code = p_code
    AND uploaded_at IS NOT NULL
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_downloads IS NULL OR download_count < max_downloads)
  RETURNING download_count INTO v_count;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION files_due_for_cleanup(p_limit integer)
RETURNS TABLE (id uuid, storage_path text, storage_backend text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT f.id, f.storage_path, f.storage_backend
  FROM files f
  WHERE f.expires_at < now()
     OR (f.max_downloads IS NOT NULL AND f.download_count >= f.max_downloads
         AND COALESCE(f.last_download_at, f.created_at) < now() - interval '15 minutes')
     OR (f.uploaded_at IS NULL AND f.created_at < now() - interval '3 hours')
  ORDER BY f.created_at
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION claim_download(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION files_due_for_cleanup(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_download(text) TO service_role;
GRANT EXECUTE ON FUNCTION files_due_for_cleanup(integer) TO service_role;
