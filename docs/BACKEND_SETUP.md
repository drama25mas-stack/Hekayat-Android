# Hekayat backend setup

The Android client is deliberately designed to call a small Cloudflare Worker API. It must never contain a Supabase service-role key, Cloudflare API token, or R2 secret.

## Required owner actions

1. Create a Supabase project and keep its project URL and public anon key.
2. Run the SQL migration in `supabase/migrations/0001_initial_schema.sql` in the Supabase SQL editor.
3. Create a private Cloudflare R2 bucket for story media.
4. Deploy the Worker in `cloudflare/worker` and bind the R2 bucket as `MEDIA`.
5. Set Worker secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD_HASH`. Never commit these values.
6. Configure the Worker URL in the Android app's `STORIES_API_BASE_URL` build config before connecting live content.

## API contract to implement

- `GET /v1/stories`: return published stories only, newest first.
- `GET /v1/stories/:id`: return one published story and a short-lived playback URL.
- `POST /v1/admin/session`: verify the owner credentials and issue a short-lived signed admin token.
- `POST /v1/admin/uploads`: admin-only; create a short-lived upload authorization for R2.
- `POST /v1/admin/stories`: admin-only; publish story metadata after upload.
- `PATCH /v1/admin/stories/:id` and `DELETE /v1/admin/stories/:id`: admin-only management.
- `POST /v1/views`: record a privacy-conscious view event with server-side rate limiting.

## Important

The app currently contains the first UI scaffold only. Live story browsing, upload, playback and admin login are not yet connected. They must not be treated as complete until the Worker is deployed, credentials are configured, and end-to-end tests pass.
