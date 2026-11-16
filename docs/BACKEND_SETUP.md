# Hekayat backend and admin deployment

The admin website and API are served by one Cloudflare Worker. The dashboard is opened at the Worker URL (root path). Only the owner can sign in; viewers do not need accounts.

## 1. Create Supabase database

1. Create a project at https://supabase.com/dashboard.
2. Open SQL Editor and run `supabase/migrations/0001_initial_schema.sql`.
3. In Project Settings → API, copy the Project URL and the `service_role` key. Keep the service-role key private; it is used only as a Cloudflare Worker secret.

## 2. Create R2 bucket

1. In Cloudflare Dashboard → R2, create a private bucket named `hekayat-media` (or update `bucket_name` in `cloudflare/worker/wrangler.toml`).
2. Do not enable public bucket access. Video playback is served through the Worker, which checks that the media belongs to a published story.

The dashboard uploads in 8 MiB multipart chunks, so large videos are not sent as one huge Worker request.

## 3. Configure and deploy Worker

Install Node.js 20+ and run these commands from `cloudflare/worker`:

```bash
npm install
npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put ADMIN_PASSWORD_SHA256
npx wrangler secret put JWT_SECRET
npx wrangler deploy
```

Secret values:
- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role key.
- `ADMIN_EMAIL`: your private administrator email.
- `ADMIN_PASSWORD_SHA256`: lowercase SHA-256 hex digest of your admin password. Generate it locally; never send the password in chat or commit it.
- `JWT_SECRET`: a random secret of at least 32 bytes. Generate locally with `openssl rand -hex 32`.

Generate the password digest:
- macOS/Linux: `printf '%s' 'YOUR_PASSWORD' | sha256sum`
- PowerShell: `$bytes=[Text.Encoding]::UTF8.GetBytes('YOUR_PASSWORD'); $sha=[Security.Cryptography.SHA256]::HashData($bytes); [Convert]::ToHexString($sha).ToLower()`

### Easier deployment from GitHub Actions

Instead of running the CLI commands above, you can deploy from GitHub after creating the R2 bucket:

1. In Cloudflare → My Profile → API Tokens, create a token from the **Edit Cloudflare Workers** template. It grants the Worker deployment permissions; restrict its account scope where possible. See the [Cloudflare token permissions reference](https://developers.cloudflare.com/fundamentals/api/reference/permissions/).
2. In this GitHub repository, open Settings → Secrets and variables → Actions → New repository secret.
3. Add these secrets (never paste them into chat or commit them):
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `HEKAYAT_ADMIN_EMAIL`
   - `HEKAYAT_ADMIN_PASSWORD_SHA256`
   - `HEKAYAT_JWT_SECRET`
4. Open Actions → **Deploy Hekayat backend and admin** → Run workflow.
5. When the run succeeds, open the Worker URL shown in Cloudflare Workers. The dashboard is at the root URL.
6. In GitHub Settings → Secrets and variables → Actions → Variables, add `STORIES_API_BASE_URL` with the Worker URL including the trailing slash, for example `https://hekayat-api.<your-subdomain>.workers.dev/`.
7. Push any commit or manually run **Android CI** to build the APK with the live API URL.

After deploy, open the Worker URL in a browser. The Hekayat Admin dashboard is served from the same Worker.

## 4. Admin functions included in this commit

- Owner-only email/password login with an 8-hour signed admin token.
- Upload videos to private R2 using multipart chunks.
- Create, edit, publish, draft and delete stories.
- Create and delete categories.
- Overview counters for all stories, published stories, drafts and recorded views.
- Public API endpoint `GET /v1/stories` for published stories and `GET /v1/media/{object-key}` for published media only, including byte-range support for video playback.

## 5. Connect the Android application

The Android client now reads published stories from `GET /v1/stories`, plays the returned video URL with Media3, and records views through `POST /v1/views`. Set the GitHub Actions variable `STORIES_API_BASE_URL` to the deployed Worker URL before building the APK. The live connection still requires the backend to be deployed and tested on a real device.

## Security and limits

- Never put Supabase service-role keys, R2 credentials or JWT signing secrets in the APK or GitHub.
- Keep the R2 bucket private.
- The Worker currently verifies the owner password by comparing its SHA-256 digest and signs short-lived admin JWTs. Use a strong unique password and rotate the secrets if exposed.
- Configure Cloudflare abuse protections/rate limiting before public launch. Add resumable upload recovery and cleanup for abandoned multipart uploads before production.
- Database and R2 capacity/costs depend on the selected provider plans; “unlimited video duration” does not mean unlimited storage or bandwidth.
