import { Prisma } from "@prisma/client";
import { ApiError } from "./api-errors";

// High-precision arithmetic stays on the server. SQLite DECIMAL has NUMERIC
// affinity, so deliberately bound persisted inputs to <= 12 significant digits.
export const Decimal = Prisma.Decimal.clone({ precision: 40, rounding: Prisma.Decimal.ROUND_HALF_UP });
export const maxMoney = "999999999.99";
export const maxQuantity = "999999999.999";

export function decimalInput(value: unknown, label: string, kind: "money" | "quantity", positive = false) {
  if ((typeof value !== "string" && typeof value !== "number") || String(value).length > 64 || !/^-?\d+(?:\.\d+)?$/.test(String(value).trim())) {
    throw new ApiError(400, "INVALID_INPUT", `${label} must be a decimal number.`);
  }
  const number = new Decimal(String(value).trim());
  const places = kind === "money" ? 2 : 3;
  const maximum = kind === "money" ? maxMoney : maxQuantity;
  if (!number.isFinite() || number.isNegative() || (positive && number.isZero()) || number.gt(maximum) || number.decimalPlaces() > places) {
    throw new ApiError(400, "INVALID_INPUT", `${label} must be ${positive ? "greater than zero" : "non-negative"}, at most ${maximum}, with at most ${places} decimal places.`);
  }
  return number;
}

export function moneyResult(value: Prisma.Decimal) {
  const result = new Decimal(value).toDecimalPlaces(2);
  if (result.gt(maxMoney)) throw new ApiError(400, "TOTAL_TOO_LARGE", "The bill total exceeds the supported amount.");
  return result;
}
