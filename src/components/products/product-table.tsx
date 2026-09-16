"use client";

import { useState } from "react";
import { Icon } from "./icon";
import type { Product } from "./product";
import s from "./products.module.css";

function ProductImage({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  return <span className={s.productImage}>{product.image && !failed ? (
    // Image strings can reference local paths or arbitrary remote hosts.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={product.image} alt="" loading="lazy" onError={() => setFailed(true)} />
  ) : <Icon name="box" size={23} />}</span>;
}

export function ProductTable({ products, onEdit, onDelete }: { products: Product[]; onEdit: (product: Product) => void; onDelete: (product: Product) => void }) {
  return <div className={s.tableScroll} tabIndex={0} role="region" aria-label="Product inventory table"><table className={s.table}>
    <thead><tr>{["Product", "Category", "Barcode", "Unit price", "Stock", "Status", "Actions"].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead>
    <tbody>{products.map(product => {
      const status = product.quantity === 0 ? "Out of Stock" : product.quantity <= 5 ? "Low Stock" : "In Stock";
      return <tr key={product.id}>
        <td><div className={s.productCell}><ProductImage key={product.image} product={product} /><div><strong>{product.name}</strong><small>#{String(product.id).padStart(4, "0")}</small></div></div></td>
        <td><span className={s.categoryLabel}>{product.category}</span></td>
        <td className={s.barcode}>{product.barcode || <span className={s.muted}>—</span>}</td>
        <td className={s.price}>Rs. {product.price.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<small className={s.priceBasis}>per {product.pricingAmount} {product.unit}</small></td>
        <td><span className={product.quantity <= 5 ? s.lowQuantity : s.quantity}>{product.quantity.toLocaleString("en-LK")}</span><span className={s.units}> units</span></td>
        <td><span className={`${s.badge} ${product.quantity === 0 ? s.out : product.quantity <= 5 ? s.low : s.inStock}`}><i />{status}</span></td>
        <td><div className={s.rowActions}><button className={s.iconButton} onClick={() => onEdit(product)} aria-label={`Edit ${product.name}`} title="Edit product"><Icon name="edit" size={17} /></button><button className={`${s.iconButton} ${s.deleteAction}`} onClick={() => onDelete(product)} aria-label={`Delete ${product.name}`} title="Delete product"><Icon name="trash" size={17} /></button></div></td>
      </tr>;
    })}</tbody>
  </table></div>;
}
