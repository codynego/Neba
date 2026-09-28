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

## API

- `/api/auth/register/`, `login/`, `logout/`, `me/`
- `/api/tasks/` — browse, post, filter by city/category/search; `/{id}/complete/` and `/{id}/cancel/`
- `/api/offers/` — browse and publish service offers
- `/api/applications/` — apply, view sent/received, and `/{id}/accept/`
- `/api/cities/` — optional city directory

Run `python manage.py test tasks` to verify the core task flow.

## Pilot boundaries

Payment is arranged directly between participants. Nearwork does not hold money, verify identity, insure work, or provide in-app messaging yet. Applicants share a phone number with the task requester for coordination. The Django admin is available for manual operations. Add moderation, verification, dispute handling, and secure payments before an open public launch.
