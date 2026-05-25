const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export const monthPattern = MONTH_PATTERN.source;

export const parseMonthRange = (month: string) => {
  if (!MONTH_PATTERN.test(month)) return undefined;

  const [year, monthIndex] = month.split('-').map(Number);
  if (monthIndex < 1 || monthIndex > 12) return undefined;

  // Use UTC so month-based queries do not shift at timezone boundaries.
  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  const end = new Date(Date.UTC(year, monthIndex, 1));

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
};

export const daysUntil = (date: string) => {
  const time = new Date(date).getTime();
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;

  return Math.ceil((time - Date.now()) / 86400000);
};
