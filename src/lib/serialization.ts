import type { Product, Prisma } from "@prisma/client";

export function serializeProduct(product: Product) {
  return {
    id: product.id, name: product.name, category: product.category,
    price: product.price.toFixed(2), pricingAmount: product.pricingAmount.toFixed(),
    unit: product.unit, quantity: product.quantity.toFixed(), version: product.version,
    barcode: product.barcode, image: product.image,
    createdAt: product.createdAt.toISOString(), updatedAt: product.updatedAt.toISOString(),
  };
}

type SaleWithItems = Prisma.SaleGetPayload<{ include: { items: true } }>;

export function serializeSale(sale: SaleWithItems) {
  return {
    id: sale.id, invoiceNumber: `INV-${String(sale.id).padStart(6, "0")}`, requestId: sale.requestId,
    subtotal: sale.subtotal.toFixed(2), discount: sale.discount.toFixed(2), total: sale.total.toFixed(2),
    paymentMethod: sale.paymentMethod, amountTendered: sale.amountTendered?.toFixed(2) ?? null,
    changeDue: sale.changeDue?.toFixed(2) ?? null, createdAt: sale.createdAt.toISOString(),
    items: sale.items.map(item => ({
      id: item.id, saleId: item.saleId, productId: item.productId, productName: item.productName,
      barcode: item.barcode, unit: item.unit, pricingAmount: item.pricingAmount.toFixed(),
      unitPrice: item.unitPrice.toFixed(2), quantity: item.quantity.toFixed(), lineTotal: item.lineTotal.toFixed(2),
    })),
  };
}
