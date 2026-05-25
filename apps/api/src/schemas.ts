import { t } from 'elysia';
import { monthPattern } from './lib/dates';

export const authSchemas = {
  emailPassword: t.Object({
    email: t.String({ format: 'email' }),
    password: t.String({ minLength: 6 })
  }),
  phone: t.Object({
    phone: t.String({ minLength: 8 })
  }),
  verifyOtp: t.Object({
    phone: t.String({ minLength: 8 }),
    token: t.String({ minLength: 4 })
  })
};

export const ingredientSchemas = {
  catalogQuery: t.Object({
    query: t.Optional(t.String()),
    itemCode: t.Optional(t.String()),
    page: t.Optional(t.Numeric({ minimum: 1 })),
    pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 1000 }))
  }),
  listQuery: t.Object({
    includeCatalog: t.Optional(t.Boolean()),
    expiringBefore: t.Optional(t.String({ format: 'date-time' }))
  }),
  detailQuery: t.Object({
    includeCatalog: t.Optional(t.Boolean())
  }),
  createBody: t.Object({
    itemCode: t.String({ minLength: 1 }),
    expiresAt: t.String({ format: 'date-time' }),
    totalQuantity: t.Number({ minimum: 0 }),
    remainingQuantity: t.Optional(t.Number({ minimum: 0 }))
  }),
  updateBody: t.Object({
    expiresAt: t.Optional(t.String({ format: 'date-time' })),
    totalQuantity: t.Optional(t.Number({ minimum: 0 })),
    remainingQuantity: t.Optional(t.Number({ minimum: 0 }))
  }),
  consumeBody: t.Object({
    remainingQuantity: t.Number({ minimum: 0 })
  }),
  calendarQuery: t.Object({
    month: t.String({ pattern: monthPattern })
  }),
  shopLinksQuery: t.Object({
    name: t.String({ minLength: 1 })
  })
};

export const recipeSchemas = {
  listQuery: t.Object({
    page: t.Optional(t.Numeric({ minimum: 1 })),
    pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 }))
  }),
  recommendationQuery: t.Object({
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
    maxMissingIngredients: t.Optional(t.Numeric({ minimum: 0, maximum: 20 })),
    expiringWithinDays: t.Optional(t.Numeric({ minimum: 0, maximum: 30 }))
  })
};
