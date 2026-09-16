export const measurementUnits = ["g", "Kg", "Ltr", "Pkt", "Pcs", "Bottle", "ml"] as const;
export type MeasurementUnit = typeof measurementUnits[number];

export function isMeasurementUnit(value: unknown): value is MeasurementUnit {
  return typeof value === "string" && measurementUnits.some(unit => unit === value);
}

export function isPricingAmount(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
