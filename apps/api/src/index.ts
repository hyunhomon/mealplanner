import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { authRoutes } from './routes/auth';
import { ingredientRoutes } from './routes/ingredients';
import { recipeRoutes } from './routes/recipes';
import { reportRoutes } from './routes/reports';

const app = new Elysia()
  .use(cors({
    origin: ['http://localhost:5173'] // 프론트 개발 포트만 허용
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
        { name: 'Auth', description: 'Authentication endpoints' },
        { name: 'Ingredients', description: 'User ingredient and catalog endpoints' },
        { name: 'Recipes', description: 'Recipe search and recommendation endpoints' },
        { name: 'Reports', description: 'Savings and usage report endpoints' }
      ]
    }
  }))
  .get('/', () => 'MealPlanner API Server is Running')
  .use(authRoutes)
  .use(ingredientRoutes)
  .use(recipeRoutes)
  .use(reportRoutes)
  .listen(3000);

console.log(`http://localhost:3000`);
