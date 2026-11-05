import type { Product } from "@/components/products/product";
import { isDiscreteUnit } from "@/lib/product-pricing";
export { isDiscreteUnit };

export type CartItem = { product: Product; quantity: number };
export type PaymentMethod = "CASH" | "CARD";

export type SaleResult = {
  sale: {
    invoiceNumber: string;
    subtotal: string;
    discount: string;
    total: string;
    paymentMethod: PaymentMethod;
    amountTendered: string | null;
    changeDue: string | null;
  };
  replayed: boolean;
};

export function quantityStep(unit: string) {
  return isDiscreteUnit(unit) ? 1 : 0.001;
}

export function normaliseQuantity(quantity: number, product: Product) {
  if (!Number.isFinite(quantity)) return 0;
  const rounded = isDiscreteUnit(product.unit)
    ? Math.round(quantity)
    : Math.round(quantity * 1000) / 1000;
  return Math.min(Math.max(0, rounded), Number(product.quantity));
}

// Display-only arithmetic. The sales route recalculates prices and totals with Decimal.
export function lineTotal(item: CartItem) {
  const price = Number(item.product.price);
  const pricingAmount = Number(item.product.pricingAmount);
  return Number.isFinite(price) && pricingAmount > 0
    ? (item.quantity / pricingAmount) * price
    : 0;
}

export function cartSubtotal(items: CartItem[]) {
  return items.reduce((total, item) => total + lineTotal(item), 0);
}

export function formatMoney(value: number | string) {
  const amount = Number(value);
  return (Number.isFinite(amount) ? amount : 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatQuantity(value: number | string) {
  const quantity = Number(value);
  return (Number.isFinite(quantity) ? quantity : 0).toLocaleString("en-LK", {
    maximumFractionDigits: 3,
  });
}

export function priceBasis(product: Product) {
  return `Rs. ${formatMoney(product.price)} / ${formatQuantity(product.pricingAmount)} ${product.unit}`;
}
