import type { IngredientId } from "./ingredients";

export type RecipeId = string;

export interface RecipeStep {
  order: number;
  description: string;
  imageUrl?: string;
}

export interface RecipeNutrition {
  calories?: number;
  carbohydrate?: number;
  protein?: number;
  fat?: number;
  sodium?: number;
  weight?: number;
}

export interface Recipe {
  id: RecipeId;
  name: string;
  ingredientText: string;
  ingredientNames: string[];
  cookingMethod?: string;
  dishType?: string;
  hashTag?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  tip?: string;
  nutrition?: RecipeNutrition;
  steps: RecipeStep[];
}

export interface RecipeRecommendation {
  recipe: Recipe;
  matchedIngredientIds: IngredientId[];
  matchedIngredientNames: string[];
  missingIngredientNames: string[];
  matchScore: number;
  expiringSoonScore: number;
  score: number;
}

export interface RecipeRecommendationQuery {
  limit?: number;
  maxMissingIngredients?: number;
  expiringWithinDays?: number;
}
