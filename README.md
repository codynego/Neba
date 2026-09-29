# Nearwork

A multi-city local task marketplace MVP built with Django REST Framework and Next.js. People can post paid tasks, offer services, apply to tasks, and manage work in a dashboard.

## Project layout

- `backend/config/`: Django settings and API routing
- `backend/accounts/`: accounts and token authentication
- `backend/locations/`: location directory model and API
- `backend/tasks/`: task posts and completion state
- `backend/offers/`: service offers
- `backend/bookings/`: applications and requester selection
- `frontend/src/app/`: page routes
- `frontend/src/components/`: shared UI
- `frontend/src/lib/`: API client and types

Locations are freeform city and state fields, so the pilot can run in any city.

## Run locally

Use two terminals.

**Backend**

```powershell
cd backend
python -m pip install -r requirements.txt
$env:DJANGO_DEBUG = "true"
python manage.py migrate
python manage.py runserver
```

**Frontend**

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. The frontend defaults to http://localhost:8000/api. Set `NEXT_PUBLIC_API_URL` to change that. Django uses SQLite locally; set `DATABASE_URL` for PostgreSQL. See `backend/.env.example` for supported environment values. Environment values must be set in your shell or deployment service; Django does not automatically load the example file.

## Deploy the backend to Vercel

Create a separate Vercel project for the Django API and select `backend` as its Root Directory. Vercel detects `manage.py` and the configured WSGI application automatically.

Provision pooled PostgreSQL and Redis integrations, then configure these Production and Preview environment variables:

- `DJANGO_SECRET_KEY`: a long random value that stays unchanged
- `DJANGO_DEBUG`: `false`
- `DATABASE_URL`: the pooled PostgreSQL connection URL
- `REDIS_URL`: the Redis connection URL used for shared API throttling and caching
- `DJANGO_ALLOWED_HOSTS`: the custom API domain, if one is configured
- `CORS_ALLOWED_ORIGINS`: `https://getneba.app,https://www.getneba.app`
- `CSRF_TRUSTED_ORIGINS`: `https://getneba.app,https://www.getneba.app`
- the Cloudflare R2 values documented in `backend/.env.example`

Profile photos use a private Cloudflare R2 bucket. Create an R2 API token with object read/write access to that bucket and set `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`. Browser uploads use short-lived signed `PUT` URLs, so add this CORS policy to the bucket:

```json
[
  {
    "AllowedOrigins": ["https://getneba.app", "https://www.getneba.app", "http://localhost:3000"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Run migrations against the production database before sending traffic to a new schema. From the repository root, link the Vercel project and run:

```powershell
vercel link --project neba
cmd.exe /d /s /c "vercel env run -e production -- python backend/manage.py migrate --noinput"
```

Deploy with the Vercel Git integration or run `vercel deploy --prod` from the repository root. Verify the deployment at `/api/health/`, then set the frontend's `NEXT_PUBLIC_API_URL` to the deployed backend URL plus `/api`.

## API

- `/api/auth/register/`, `login/`, `logout/`, `me/`
- `/api/tasks/` — browse, post, filter by city/category/search; `/{id}/complete/` and `/{id}/cancel/`
- `/api/offers/` — browse and publish service offers
- `/api/applications/` — apply, view sent/received, and `/{id}/accept/`
- `/api/cities/` — optional city directory

Run `python manage.py test tasks` to verify the core task flow.

## Pilot boundaries

Payment is arranged directly between participants. Nearwork does not hold money, verify identity, insure work, or provide in-app messaging yet. Applicants share a phone number with the task requester for coordination. The Django admin is available for manual operations. Add moderation, verification, dispute handling, and secure payments before an open public launch.
