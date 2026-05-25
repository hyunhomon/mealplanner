export type ISODateString = string;
export type EntityId = string;

export type ApiResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: ApiError;
    };

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface PageRequest {
  page?: number;
  pageSize?: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}
