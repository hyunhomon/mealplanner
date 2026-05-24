// packages/shared/index.ts

// 식재료
export interface Ingredient {
  id: string;
  name: string;
  expired_at: string;
  is_consumed: boolean;
  created_at: string;
}

// 에코 절약 로그
export interface EcoSavingsLog {
  id: string;
  saved_money: number;
  carbon_reduced: number;
  created_at: string;
}

// 공통 API 응답
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 절약 통계
export interface SavingsStats {
  total_saved_money: number;
  total_carbon_reduced: number;
}