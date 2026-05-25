import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { authRoutes } from './routes/auth';
import { ingredientRoutes } from './routes/ingredients';
import { recipeRoutes } from './routes/recipes';
import { fail } from './lib/responses';

const app = new Elysia()
  .use(cors({
    origin: [Bun.env.WEB_ORIGIN ?? 'http://localhost:5173']
  }))
  .use(swagger({
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
  }))
  .onError(({ code, error, set }) => {
    if (code === 'VALIDATION') {
      return fail(set, 400, 'VALIDATION_ERROR', 'Request validation failed.', error);
    }

    if (set.status === 401) {
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
  .listen(3000);

console.log(`http://localhost:3000`);
