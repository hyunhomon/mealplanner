import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { authRoutes } from './routes/auth';
import { ingredientRoutes } from './routes/ingredients';
import { recipeRoutes } from './routes/recipes';
import { characterRoutes } from './routes/character';
import { preferencesRoutes } from './routes/preferences';
import { fail } from './lib/responses';
import { getEnv, setEnv, type EnvBindings } from './env';

const withSwagger = (app: any) => {
  if (!globalThis.Bun) return app;

  return app.use(swagger({
    path: '/swagger',
    documentation: {
      info: {
        title: 'MealPlanner API',
        version: '1.0.50',
        description: 'MealPlanner backend API'
      },
      tags: [
        { name: 'Health', description: 'Server health endpoints' },
        { name: 'Auth', description: 'Authentication endpoints' },
        { name: 'Ingredients', description: 'User ingredient and catalog endpoints' },
        { name: 'Recipes', description: 'Recipe search and recommendation endpoints' }
      ]
    }
  }));
};

const app = withSwagger(new Elysia({ aot: false })
  .use(cors({
    origin: (request) => {
      const origin = request.headers.get('origin');
      const allowedOrigins = (getEnv('WEB_ORIGIN') ?? 'http://localhost:5173')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      return Boolean(origin && allowedOrigins.includes(origin));
    }
  }))
  .onError(({ code, error, set }) => {
    if (code === 'VALIDATION') {
      return fail(set, 400, 'VALIDATION_ERROR', 'Request validation failed.', error);
    }

    if (set.status === 401 || (error as Error & { status?: number }).status === 401) {
      return fail(set, 401, 'UNAUTHORIZED', 'Authentication is required.');
    }

    return fail(set, 500, 'INTERNAL_SERVER_ERROR', 'Unexpected server error.', error);
  })
  .get('/', () => ({
    success: true,
    data: {
      name: 'MealPlanner API',
      status: 'ok'
    }
  }), {
    detail: {
      tags: ['Health'],
      summary: 'Health check'
    }
  })
  .use(authRoutes)
  .use(ingredientRoutes)
  .use(recipeRoutes)
  .use(characterRoutes)
  .use(preferencesRoutes))
  .compile();

export default {
  fetch(request: Request, env: EnvBindings) {
    setEnv(env);
    return app.fetch(request);
  }
};
