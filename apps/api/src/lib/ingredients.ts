import type { Ingredient } from '@mealplanner/shared';

export type IngredientRow = {
  id: string;
  user_id: string;
  item_code: string;
  expires_at?: string;
  expired_at?: string;
  total_quantity?: number;
  quantity?: number;
  remaining_quantity?: number;
  is_consumed?: boolean;
  created_at: string;
  updated_at?: string;
};

export const toIngredient = (row: IngredientRow): Ingredient => {
  const totalQuantity = Number(row.total_quantity ?? row.quantity ?? 1);
  const remainingQuantity = Number(row.remaining_quantity ?? (row.is_consumed ? 0 : totalQuantity));

  return {
    id: row.id,
    userId: row.user_id,
    itemCode: row.item_code,
    expiresAt: row.expires_at ?? row.expired_at ?? '',
    totalQuantity,
    remainingQuantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at
  };
};

export const assertQuantityRange = (
  totalQuantity: number | undefined,
  remainingQuantity: number | undefined
) => {
  if (totalQuantity === undefined || remainingQuantity === undefined) return true;
  return remainingQuantity <= totalQuantity;
};
