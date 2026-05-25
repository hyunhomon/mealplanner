import type { EntityId, ISODateString } from "./api";
import type { IngredientCatalogItem, IngredientItemCode } from "./catalog";
import type { UserId } from "./users";

export type IngredientId = EntityId;
export type IngredientQuantity = number;

export interface Ingredient {
  id: IngredientId;
  userId: UserId;
  itemCode: IngredientItemCode;
  expiresAt: ISODateString;
  totalQuantity: IngredientQuantity;
  remainingQuantity: IngredientQuantity;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface IngredientSummary extends Ingredient {
  item?: IngredientCatalogItem;
}

export interface CreateIngredientDto {
  itemCode: IngredientItemCode;
  expiresAt: ISODateString;
  totalQuantity: IngredientQuantity;
  remainingQuantity?: IngredientQuantity;
}

export interface UpdateIngredientDto {
  expiresAt?: ISODateString;
  totalQuantity?: IngredientQuantity;
  remainingQuantity?: IngredientQuantity;
}

export interface ConsumeIngredientDto {
  remainingQuantity: IngredientQuantity;
}

export interface IngredientListQuery {
  includeCatalog?: boolean;
  expiringBefore?: ISODateString;
}
