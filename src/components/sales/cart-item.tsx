"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/products/icon";
import { ProductImage } from "./product-image";
import { formatMoney, formatQuantity, isDiscreteUnit, lineTotal, normaliseQuantity, priceBasis, quantityStep, type CartItem as CartItemType } from "./sales";
import s from "./sales.module.css";

export function CartItem({ item, onQuantityChange, onRemove }: { item: CartItemType; onQuantityChange: (quantity: number) => void; onRemove: () => void }) {
  const [draft, setDraft] = useState(String(item.quantity));
  useEffect(() => setDraft(String(item.quantity)), [item.quantity]);
  const max = Number(item.product.quantity);
  const step = quantityStep(item.product.unit);
  function commitDraft() {
    const quantity = normaliseQuantity(Number(draft), item.product);
    onQuantityChange(quantity);
    setDraft(String(quantity));
  }
  const decrement = () => onQuantityChange(normaliseQuantity(item.quantity - step, item.product));
  const increment = () => onQuantityChange(normaliseQuantity(item.quantity + step, item.product));
  return <article className={s.cartItem}>
    <ProductImage product={item.product} compact />
    <div className={s.cartItemDetails}><strong>{item.product.name}</strong><small>{formatQuantity(item.quantity)} {item.product.unit} × {priceBasis(item.product)}</small><span>In stock: {formatQuantity(max)} {item.product.unit}</span></div>
    <div className={s.cartItemActions}><button type="button" className={s.removeButton} onClick={onRemove} aria-label={`Remove ${item.product.name}`}><Icon name="trash" size={15} /></button><strong>Rs. {formatMoney(lineTotal(item))}</strong><div className={s.quantityControl}><button type="button" onClick={decrement} disabled={item.quantity <= step} aria-label={`Decrease ${item.product.name}`}><Icon name="left" size={14} /></button><input aria-label={`Quantity for ${item.product.name}`} type="number" min={step} max={max} step={step} inputMode={isDiscreteUnit(item.product.unit) ? "numeric" : "decimal"} value={draft} onChange={event => setDraft(event.target.value)} onBlur={commitDraft} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} /><button type="button" onClick={increment} disabled={item.quantity >= max} aria-label={`Increase ${item.product.name}`}><Icon name="plus" size={14} /></button></div></div>
  </article>;
}
