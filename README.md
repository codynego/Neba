# Neba

Neba is an education ecosystem. The first live product, **Neba for Schools**, gives school teams a private workspace for records, teaching work, assessment evidence, and explainable academic signals. Neba Opportunities remains an ecosystem product for scholarships, grants, and academic pathways.

## Project layout

- `frontend/` — Next.js application and the public Neba site
- `backend/` — Django REST API, school data model, and administrative tools
- `backend/schools/` — school setup, role-based access, roster, assessment, and academic-intelligence APIs
- `docs/launch-checklist.md` — the release owner’s pre-launch checklist

## Run locally

Use two terminals.

```powershell
cd backend
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The frontend defaults to `http://localhost:8000/api`; set `NEXT_PUBLIC_API_URL` when the API uses another origin.

Copy the documented environment-variable names from `frontend/.env.example` and `backend/.env.example`. Never commit a populated `.env` file.

## Verification

```powershell
cd frontend
npm run typecheck
npm run build

cd ..\backend
python manage.py makemigrations --check --dry-run
python manage.py test
```

When local development is connected to a shared PostgreSQL database, use a separate disposable database for tests. Do not let Django delete a shared test database.

## Production release

Deploy the frontend and Django API as separate Vercel projects, with `frontend` and `backend` respectively as their root directories.

Before routing public traffic:

1. Configure the production secrets and public origins listed in the example environment files.
2. Set a stable `DJANGO_SECRET_KEY`, production `DATABASE_URL`, `REDIS_URL`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `FRONTEND_URL`, and `NEXT_PUBLIC_API_URL`.
3. Set Neba’s legal operator name, address, and privacy contact in the frontend environment variables.
4. Run `python backend/manage.py migrate --noinput` against the production database.
5. Confirm `https://API_DOMAIN/api/health/`, the school setup journey, staff access controls, score entry, and academic intelligence with production-like accounts.

Use [the launch checklist](docs/launch-checklist.md) as the release sign-off record.
