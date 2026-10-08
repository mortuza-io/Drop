# drop

Send files. Leave no trace. Drop a file up to 100 MB, get a link and QR code, and it deletes itself on schedule. No account needed.

## Features

- Drag-and-drop upload up to 100 MB with live progress, speed, and cancel
- Shareable link + QR code (copy, save as PNG, native share)
- Auto-delete after 1h, 1d, 7d, 30d, 90d, or a custom time (max 90 days)
- Optional download limit and password protection
- "Your uploads" panel: the browser remembers your files (no account), with details, copy link, and delete
- Light and dark themes, responsive layout

## How it works

| Piece | Where it runs | Job |
| --- | --- | --- |
| Web app (`src/`) | Any static host | The interface. Never touches storage keys. |
| `files` API (`api/files.ts`) | Vercel Serverless Function | Validates uploads, signs short-lived R2 upload/download URLs, checks passwords, enforces limits, lists and deletes your files. |
| `cleanup` function | Supabase Edge Functions | Deletes expired, used-up, and abandoned files from R2 and the database. |
| Database | Supabase Postgres | File records (name, size, expiry, limits, hashed password, hashed owner token). Runs `cleanup` every 15 minutes via `pg_cron`. |
| File bytes | Cloudflare R2 | Uploaded directly from the browser through signed URLs. |

### Upload flow

1. The browser asks the `files` API to `create` an upload. The server validates size (≤ 100 MB), lifetime (≤ 90 days), and limits, then returns a download code, a secret owner token, and a 1-hour signed R2 upload URL.
2. The browser `PUT`s the file straight to R2.
3. The browser calls `finalize`. The server confirms the object exists in R2 with the declared size before the link goes live.
4. The code and owner token are saved in `localStorage` so the "Your uploads" panel works without an account.

### Security

- The database denies all direct browser access; only the server functions (service role) can read or write it.
- R2 credentials live only in server secrets.
- Passwords are hashed with PBKDF2-SHA256 (100k iterations, random salt). After 10 wrong attempts a file locks for 15 minutes.
- Downloads are counted atomically, so limits can't be raced. Download URLs expire after 5 minutes and always save as attachments.
- Owner tokens are stored hashed. Listing or deleting a file requires the token.
- Error messages shown to users are generic; details stay in server logs.

## Setup

### 1. Cloudflare R2

1. Create an R2 bucket.
2. Create an R2 API token with **Object Read & Write** on that bucket. Note the Access Key ID and Secret Access Key.
3. Add a CORS policy to the bucket (Settings > CORS policy), replacing the origin with your site's address:

```json
[
  {
    "AllowedOrigins": ["https://your-site.example"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

### 2. Server secrets

Add these as server-side environment variables (Vercel Project Settings > Environment Variables, or Supabase Edge Function secrets if you still use that runtime):

| Secret | Value |
| --- | --- |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `R2_ACCOUNT_ID` | Your Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_BUCKET_NAME` | The bucket name |

### 3. Frontend environment

`.env` needs:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### 4. Run

```bash
npm install
npm run dev     # local development
npm run build   # production build in dist/
```

## Deploy to Vercel

The web app and the `/api/files` upload API run on Vercel. The database stays on Supabase, and file bytes stay in R2.

1. Push this project to GitHub and import it in Vercel (framework preset: Vite). `vercel.json` already sets the build command, output folder, page routing, and security headers.
2. In Vercel > Project > Settings > Environment Variables, add:
   - Client env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - Server env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
   Then redeploy.
3. Add your Vercel domain (e.g. `https://your-app.vercel.app` and any custom domain) to `AllowedOrigins` in the R2 bucket's CORS policy, or uploads will be blocked.

## Project structure

```
src/
  App.tsx                 page flow: upload, share, download
  components/             UI pieces (drop zone, options, panels, views)
  lib/api.ts              calls `/api/files` (or a configured endpoint)
  lib/history.ts          browser-remembered uploads
  lib/upload.ts           direct-to-R2 upload with progress
api/
  files.ts                Vercel server API for upload/download/list/delete
supabase/
  functions/files/        main server function
  functions/cleanup/      scheduled auto-delete
  migrations/             database schema, security, and cron schedule
  config.toml             function settings
```

## Credits

Built with love by [mortuza-io](https://github.com/mortuza-io).
