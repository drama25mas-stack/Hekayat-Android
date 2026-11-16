# Cloudflare Worker

This directory defines the server-side boundary for Hekayat. The Worker will authenticate the single owner/admin, create short-lived R2 upload and playback URLs, and use the Supabase service role only on the server.

Required bindings and secrets:
- R2 bucket binding: `MEDIA`
- Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`
- Optional vars: `ALLOWED_ORIGIN`

Do not deploy a public upload endpoint without admin authentication, content-length limits, MIME validation, rate limiting and signed upload expiry. The API is not yet deployed; see `docs/BACKEND_SETUP.md`.
