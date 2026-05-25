export type IngredientItemCode = string;

export interface IngredientCatalogItem {
  itemCode: IngredientItemCode;
  name: string;
  variety?: string;
  category?: string;
  unit?: string;
  unitSize?: string;
  grade?: string;
  market?: string;
  region?: string;
  surveyedAt?: string;
  price?: number;
  convertedPrice?: number;
}

export interface IngredientCatalogSearchParams {
  query?: string;
  itemCode?: IngredientItemCode;
  page?: number;
  pageSize?: number;
}
