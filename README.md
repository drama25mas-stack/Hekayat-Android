# Hekayat Android

Hekayat is an Android video-stories app with a separate owner-only web administration dashboard.

## Repository contents
- `app/`: Android Kotlin + Jetpack Compose starter.
- `admin/`: Arabic RTL admin dashboard for stories, uploads, categories and overview stats.
- `cloudflare/worker/`: API, owner authentication, R2 multipart upload and published-media delivery.
- `supabase/migrations/`: PostgreSQL schema and public read policies.
- `.github/workflows/android-build.yml`: Android debug APK build workflow.

## Current status
The Android UI scaffold and the web admin/API source have been committed. The backend is **not live yet**: the owner must create Supabase and Cloudflare resources, configure Worker secrets, and deploy the Worker. Android live feed/player integration and a verified APK build are still pending.

See [Backend and admin deployment](docs/BACKEND_SETUP.md) for the exact setup steps.
