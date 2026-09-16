import { Prisma, type PrismaClient } from "@prisma/client";
import { ApiError, objectBody, productId } from "./api-errors";
import { Decimal, decimalInput, moneyResult, maxQuantity } from "./decimal";
import { isDiscreteUnit, isMeasurementUnit } from "./product-pricing";
import { serializeSale } from "./serialization";

const includeItems = { items: { orderBy: { id: "asc" as const } } };

export async function completeSale(db: PrismaClient, fields: Record<string, unknown>) {
  if (typeof fields.requestId !== "string" || !fields.requestId.trim() || fields.requestId.length > 128) {
    throw new ApiError(400, "INVALID_REQUEST_ID", "A requestId of 1–128 characters is required.");
  }
  const requestId = fields.requestId.trim();
  // The first completed request wins, including after prices change or products
  // are deleted. Never recalculate or deduct again for an existing request ID.
  const existing = await db.sale.findUnique({ where: { requestId }, include: includeItems });
  if (existing) return { sale: serializeSale(existing), replayed: true };

  if (!Array.isArray(fields.items) || !fields.items.length || fields.items.length > 200) throw new ApiError(400, "INVALID_ITEMS", "Provide between 1 and 200 sale items.");
  const items = new Map<number, Prisma.Decimal>();
  const fractionalProducts = new Set<number>();
  for (const input of fields.items) {
    const item = objectBody(input);
    const id = productId(item.productId);
    const quantity = decimalInput(item.quantity, "Sold quantity", "quantity", true);
    if (!quantity.isInteger()) fractionalProducts.add(id);
    const combined = new Decimal(items.get(id) ?? 0).plus(quantity);
    if (combined.gt(maxQuantity)) throw new ApiError(400, "INVALID_INPUT", "Combined product quantity is too large.");
    items.set(id, combined);
  }
  const discount = decimalInput(fields.discount === undefined ? 0 : fields.discount, "Discount", "money");
  const paymentMethod = fields.paymentMethod;
  if (paymentMethod !== "CASH" && paymentMethod !== "CARD") throw new ApiError(400, "INVALID_PAYMENT_METHOD", "Payment method must be CASH or CARD.");
  const amountTendered = paymentMethod === "CASH" ? decimalInput(fields.amountTendered, "Amount tendered", "money") : null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async tx => {
        const replay = await tx.sale.findUnique({ where: { requestId }, include: includeItems });
        if (replay) return { sale: serializeSale(replay), replayed: true };
        const lines: Prisma.SaleItemCreateWithoutSaleInput[] = [];
        let subtotal = new Decimal(0);
        for (const [id, quantity] of [...items].sort(([a], [b]) => a - b)) {
          const product = await tx.product.findUnique({ where: { id } });
          if (!product) throw new ApiError(404, "PRODUCT_NOT_FOUND", `Product ${id} no longer exists.`);
          if (!isMeasurementUnit(product.unit) || !product.pricingAmount.isPositive() || product.price.isNegative()) {
            throw new ApiError(409, "INVALID_PRODUCT_PRICING", `Check the pricing settings for ${product.name}.`);
          }
          if (isDiscreteUnit(product.unit) && fractionalProducts.has(id)) throw new ApiError(400, "WHOLE_QUANTITY_REQUIRED", `${product.name} (${product.unit}) must be sold in whole quantities.`);
          if (product.quantity.lt(quantity)) throw new ApiError(409, "INSUFFICIENT_STOCK", `Not enough stock for ${product.name}. Available: ${product.quantity.toFixed()} ${product.unit}.`);
          const lineTotal = moneyResult(new Decimal(quantity).times(product.price).div(product.pricingAmount));
          subtotal = moneyResult(subtotal.plus(lineTotal));
          // Compare-and-set protects both price and stock from concurrent edits.
          // Compute in Decimal rather than SQLite's floating-point subtraction.
          const changed = await tx.product.updateMany({
            where: { id, version: product.version, quantity: { gte: quantity } },
            data: { quantity: new Decimal(product.quantity).minus(quantity), version: { increment: 1 } },
          });
          if (changed.count !== 1) throw new ApiError(409, "STOCK_CHANGED", "Stock changed during checkout. Retry with the same request ID.");
          lines.push({ product: { connect: { id } }, productName: product.name, barcode: product.barcode,
            unit: product.unit, pricingAmount: product.pricingAmount, unitPrice: product.price, quantity, lineTotal });
        }
        if (discount.gt(subtotal)) throw new ApiError(400, "INVALID_DISCOUNT", "Discount cannot exceed the subtotal.");
        const total = moneyResult(subtotal.minus(discount));
        if (amountTendered && amountTendered.lt(total)) throw new ApiError(400, "INSUFFICIENT_CASH", "Amount tendered must cover the final total.");
        const sale = await tx.sale.create({
          data: { requestId, subtotal, discount, total, paymentMethod, amountTendered,
            changeDue: amountTendered ? moneyResult(amountTendered.minus(total)) : null, items: { create: lines } },
          include: includeItems,
        });
        return { sale: serializeSale(sale), replayed: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !["P2002", "P1008", "P2028", "P2034"].includes(error.code)) throw error;
      // A competing copy may have committed while this transaction rolled back.
      const replay = await db.sale.findUnique({ where: { requestId }, include: includeItems });
      if (replay) return { sale: serializeSale(replay), replayed: true };
      if (attempt === 2) throw new ApiError(503, "DATABASE_BUSY", "Checkout is busy. Retry with the same request ID.");
      await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
  throw new ApiError(503, "DATABASE_BUSY", "Retry checkout with the same request ID.");
}
