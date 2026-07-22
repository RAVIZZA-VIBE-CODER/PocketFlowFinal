# Community backend

The website worker includes a dormant backend for monthly contest submissions,
surveys, event signups, and private campaign administration.

## Required bindings

- `ASSETS`: static website assets.
- `COMMUNITY_DB`: a D1-compatible SQL database initialized with
  `migrations/0001_community.sql`.
- `COMMUNITY_UPLOADS`: a private R2-compatible object bucket.
- `ADMIN_USERNAME`: private administrator username.
- `ADMIN_PASSWORD`: private administrator password.
- `ADMIN_SESSION_SECRET`: long random value used to sign eight-hour sessions.

The public deployment must supply these values outside the repository. The API
returns `503` without configured storage or authentication bindings.

## Routes

- `GET /api/community/campaigns`: published surveys, events, and contests.
- `POST /api/community/submissions`: multipart contest entry, with an optional
  allow-listed attachment of up to 10 MB.
- `POST /api/community/responses`: survey or event response.
- `POST /api/admin/login`: creates an HTTP-only, same-site session.
- `GET|POST /api/admin/campaigns`: lists or creates campaigns.
- `GET /api/admin/entries`: lists private contest and campaign responses.
- `POST /api/admin/logout`: clears the session.

The browser administration surface lives at `/admin` and is intentionally not
linked from public navigation.
