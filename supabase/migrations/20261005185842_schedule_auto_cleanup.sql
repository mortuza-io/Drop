/*
# Schedule automatic file cleanup every 15 minutes

## Plain-English summary
Turns on the database's built-in scheduler and web-request helper, then schedules a job that calls the
`cleanup` server function every 15 minutes. That function deletes stored files (and their records) that
have expired, used up their download limit, or were abandoned mid-upload.

## 1. Extensions
- `pg_cron` (job scheduler), `pg_net` (lets the database make HTTP requests).

## 2. Scheduled job
- `drop-auto-cleanup` - every 15 minutes, POSTs to the cleanup function with the secret from `internal_config`.

## 3. Security
- The cleanup function rejects any request that does not carry the secret, which is never exposed to browsers.

## 4. Important notes
1. Re-running this migration replaces the job with the same name instead of creating a duplicate.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'drop-auto-cleanup',
  '*/15 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://xsynjcpplvljrsgvvzhl.supabase.co/functions/v1/cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cleanup-secret', (SELECT value FROM public.internal_config WHERE key = 'cleanup_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);
