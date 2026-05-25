import type { ApiError, ApiResult } from '@mealplanner/shared';

export type HttpStatus =
  | 400
  | 401
  | 404
  | 409
  | 422
  | 500
  | 502;

const toErrorDetails = (details: unknown) => {
  if (details instanceof Error) {
    return {
      name: details.name,
      message: details.message
    };
  }

  return details;
};

export const ok = <T>(data: T): ApiResult<T> => ({
  success: true,
  data
});

export const fail = (
  set: { status?: unknown },
  status: HttpStatus,
  code: string,
  message: string,
  details?: unknown
): ApiResult<never> => {
  (set as { status: number }).status = status;
  const error: ApiError = {
    code,
    message,
    ...(details === undefined ? {} : { details: toErrorDetails(details) })
  };

  return {
    success: false,
    error
  };
};
