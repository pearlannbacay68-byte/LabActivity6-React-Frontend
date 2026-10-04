# LavaLust React frontend

This Vite app talks to the LavaLust HTTP API. It never connects to the database.

## Run locally

1. Copy `.env.example` to `.env` and set `VITE_API_URL` to the base URL serving LavaLust. For this Laragon project layout, the default is `http://localhost/LabExercise_4/LavaLust/public`.
2. Install dependencies with `npm install`.
3. Start the development server with `npm run dev`.

The API must allow requests from the Vite development origin. The configured routes return product records in a `{ "data": [...] }` response, and API errors in an `{ "error": "..." }` response.

The `frontend/` directory is excluded from the PHP Docker build by the sibling `.dockerignore`.
