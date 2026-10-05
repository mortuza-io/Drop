/*
# Raise upload size limit to 100 MB

1. Modified Storage
  - `uploads` bucket: set `file_size_limit` to 104857600 bytes (100 MB)

2. Notes
  1. No data changes; existing files untouched.
*/

UPDATE storage.buckets
SET file_size_limit = 104857600
WHERE id = 'uploads';
