import type { Product } from "@prisma/client";
import { ApiError } from "./api-errors";
import { decimalInput } from "./decimal";
import { isDiscreteUnit, isMeasurementUnit } from "./product-pricing";

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new ApiError(400, "INVALID_INPUT", `${field} is required.`);
  return value.trim();
}

function optionalText(value: unknown, field: string) {
  if (value == null) return null;
  if (typeof value !== "string") throw new ApiError(400, "INVALID_INPUT", `${field} must be text or null.`);
  return value.trim() || null;
}

export function productInput(fields: Record<string, unknown>, current?: Product) {
  const value = (key: keyof Product, fallback?: unknown) => Object.hasOwn(fields, key) ? fields[key] : current ? current[key]?.toString() ?? null : fallback;
  const unit = value("unit", "Pcs");
  if (!isMeasurementUnit(unit)) throw new ApiError(400, "INVALID_UNIT", "Select a valid measurement unit.");
  const quantity = decimalInput(value("quantity", 0), "Stock quantity", "quantity");
  const pricingAmount = decimalInput(value("pricingAmount", 1), "Pricing amount", "quantity", true);
  if (isDiscreteUnit(unit) && !quantity.isInteger()) throw new ApiError(400, "WHOLE_QUANTITY_REQUIRED", `${unit} stock must be a whole number.`);
  return {
    name: text(value("name"), "Name"), category: text(value("category"), "Category"),
    price: decimalInput(value("price"), "Unit price", "money"), pricingAmount, unit, quantity,
    barcode: optionalText(value("barcode"), "Barcode"), image: optionalText(value("image"), "Image"),
  };
}
