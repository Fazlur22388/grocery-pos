"use client";

import { Icon } from "@/components/products/icon";
import { CartItem } from "./cart-item";
import { formatMoney, formatQuantity, type CartItem as CartItemType } from "./sales";
import s from "./sales.module.css";

export function Cart({ items, subtotal, discount, total, onQuantityChange, onRemove, onClear, onDiscountChange }: { items: CartItemType[]; subtotal: number; discount: string; total: number; onQuantityChange: (id: number, quantity: number) => void; onRemove: (id: number) => void; onClear: () => void; onDiscountChange: (value: string) => void }) {
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  return <><div className={s.billHeader}><div><h2>Current Bill</h2><p>{formatQuantity(count)} item{count === 1 ? "" : "s"}</p></div><button type="button" className={s.clearButton} onClick={onClear} disabled={!items.length}><Icon name="trash" size={15} />Clear cart</button></div>
    <div className={s.cartList}>{items.length ? items.map(item => <CartItem key={item.product.id} item={item} onQuantityChange={quantity => onQuantityChange(item.product.id, quantity)} onRemove={() => onRemove(item.product.id)} />) : <div className={s.emptyCart}><span><Icon name="cart" size={29} /></span><strong>Your bill is empty</strong><p>Search or scan a product to add it here.</p></div>}</div>
    <div className={s.summary}><div><span>Subtotal</span><strong>Rs. {formatMoney(subtotal)}</strong></div><label><span>Discount <small>Fixed Rs.</small></span><input aria-label="Discount in rupees" type="number" min="0" max={subtotal} step="0.01" inputMode="decimal" placeholder="0.00" value={discount} onChange={event => onDiscountChange(event.target.value)} /></label><div className={s.totalRow}><span>Total</span><strong>Rs. {formatMoney(total)}</strong></div></div>
  </>;
}
