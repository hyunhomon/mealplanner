# MealPlanner API

Bun + Elysia backend for MealPlanner.

## Development

```bash
bun run dev
```

The server listens on `http://localhost:3000`.
Swagger UI is available at `http://localhost:3000/swagger`.

## Required Environment

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `INGREDIENT_API_KEY`
- `RECIPE_API_KEY`

Optional:

- `WEB_ORIGIN`, default `http://localhost:5173`
- `AUTH_REDIRECT_URL`, default `http://localhost:5173`
- `INGREDIENT_API_BASE_URL`
- `INGREDIENT_API_FROM_DATE`
- `INGREDIENT_API_TO_DATE`
- `RECIPE_API_BASE_URL`
- `RECIPE_RECOMMENDATION_SCAN_LIMIT`

## Architecture

- `src/index.ts`: app composition, CORS, Swagger, global error handling.
- `src/schemas.ts`: Elysia request schemas. These drive runtime validation and Swagger docs.
- `src/middleware/auth.ts`: Bearer token validation through Supabase Auth.
- `src/lib`: shared helpers for response shape, date parsing, and DB row normalization.
- `src/routes`: HTTP endpoints grouped by domain.
- `src/services`: external catalog API clients and normalization logic.

All successful API responses use:

```ts
{ success: true, data: ... }
```

All handled API errors use:

```ts
{ success: false, error: { code, message, details? } }
```
