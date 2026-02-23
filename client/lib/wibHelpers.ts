export type WibDateInput = string | number | Date;

const toDate = (value: WibDateInput): Date => {
  return value instanceof Date ? value : new Date(value);
};

export const formatWibDate = (value: WibDateInput): string => {
  const date = toDate(value);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "short",
    day: "2-digit"
  }).format(date);
};

export const formatWibDayName = (value: WibDateInput): string => {
  const date = toDate(value);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    weekday: "long"
  }).format(date);
};

export const formatWibMonthDay = (value: WibDateInput): string => {
  const date = toDate(value);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    month: "short",
    day: "2-digit"
  }).format(date);
};

export const formatWibTime = (value: WibDateInput): string => {
  const date = toDate(value);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
};

export const formatWibDateTime = (value: WibDateInput): string => {
  const date = toDate(value);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
};

