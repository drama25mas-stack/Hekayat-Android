# Hekayat Android

Android video-stories app. Viewers can browse and watch published stories without signing in. Publishing and management are restricted to the owner/admin.

## Project status

Initial Android project scaffold and CI workflow are being established. Backend provisioning (Supabase + Cloudflare R2 + Worker) requires owner-created project credentials and deployment secrets; no secrets belong in the APK or repository.

## Build

GitHub Actions builds a debug APK on pushes and pull requests. The release workflow will be enabled after signing configuration is supplied.

## Backend setup

See `docs/BACKEND_SETUP.md` for the secure backend contract and required configuration.
