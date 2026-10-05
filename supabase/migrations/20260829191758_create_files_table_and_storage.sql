/*
# Create files table and storage bucket for file uploads

1. New Tables
  - `files`
    - `id` (uuid, primary key) - unique file identifier
    - `filename` (text, not null) - original filename
    - `storage_path` (text, not null) - path in storage bucket
    - `file_size` (bigint, not null) - file size in bytes
    - `mime_type` (text) - MIME type of the file
    - `download_code` (text, unique, not null) - short code for download link
    - `download_count` (integer, default 0) - number of times downloaded
    - `max_downloads` (integer) - max allowed downloads (null = unlimited)
    - `expires_at` (timestamptz) - when file should be auto-deleted
    - `password_hash` (text) - optional password protection (hashed)
    - `created_at` (timestamptz) - upload timestamp

2. Storage
  - Create `uploads` bucket for public file storage

3. Security
  - Enable RLS on `files` table
  - Allow anon + authenticated full CRUD (no auth required - public file sharing)
  - Storage policies for anon + authenticated upload and download

4. Notes
  - This is a single-tenant public file sharing app, no auth required
  - download_code is used to generate short shareable links
  - expires_at enables auto-delete functionality
*/

-- Create the files metadata table
CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text,
  download_code text UNIQUE NOT NULL,
  download_count integer NOT NULL DEFAULT 0,
  max_downloads integer,
  expires_at timestamptz,
  password_hash text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Policies for anon + authenticated (public file sharing, no auth)
DROP POLICY IF EXISTS "anon_select_files" ON files;
CREATE POLICY "anon_select_files" ON files FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_files" ON files;
CREATE POLICY "anon_insert_files" ON files FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_files" ON files;
CREATE POLICY "anon_update_files" ON files FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_files" ON files;
CREATE POLICY "anon_delete_files" ON files FOR DELETE
  TO anon, authenticated USING (true);

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for uploading
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
CREATE POLICY "Allow public uploads" ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'uploads');

-- Storage policies for reading/downloading
DROP POLICY IF EXISTS "Allow public downloads" ON storage.objects;
CREATE POLICY "Allow public downloads" ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'uploads');

-- Storage policies for deleting (for auto-delete)
DROP POLICY IF EXISTS "Allow public deletes" ON storage.objects;
CREATE POLICY "Allow public deletes" ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'uploads');

-- Index on download_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_files_download_code ON files(download_code);

-- Index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_files_expires_at ON files(expires_at);
