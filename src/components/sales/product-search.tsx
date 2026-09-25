"use client";

import { Icon } from "@/components/products/icon";
import type { Product } from "@/components/products/product";
import { formatQuantity, priceBasis } from "./sales";
import { ProductImage } from "./product-image";
import s from "./sales.module.css";

export function ProductSearch({ query, products, loading, feedback, onQueryChange, onScan, onAdd }: {
  query: string; products: Product[]; loading: boolean; feedback: string; onQueryChange: (value: string) => void; onScan: () => void; onAdd: (product: Product) => void;
}) {
  const term = query.trim().toLocaleLowerCase();
  const matches = products.filter(product => !term || product.name.toLocaleLowerCase().includes(term) || product.barcode?.toLocaleLowerCase().includes(term));
  return <section className={s.catalogue} aria-label="Product selection">
    <div className={s.searchRow}>
      <label className={s.search}><Icon name="search" size={19} /><input autoFocus value={query} onChange={event => onQueryChange(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); onScan(); } }} placeholder="Scan barcode or search products…" aria-label="Scan barcode or search products" />
        {query && <button type="button" onClick={() => onQueryChange("")} aria-label="Clear search"><Icon name="close" size={16} /></button>}
      </label>
      <button type="button" className={s.scanButton} onClick={onScan} disabled={!query.trim() || loading}><Icon name="cart" size={17} />Add barcode</button>
    </div>
    <p className={s.searchHint}>Keep this field focused for a USB barcode scanner. Press Enter to add an exact barcode match.</p>
    {feedback && <div className={s.inlineFeedback} role="status">{feedback}</div>}
    <div className={s.productResults} aria-busy={loading}>
      {loading ? <div className={s.emptyResults}><Icon name="refresh" size={26} /><strong>Loading products</strong><span>Getting the current catalogue from your shop.</span></div> : matches.length ? matches.map(product => {
        const stock = Number(product.quantity);
        return <article className={s.productCard} key={product.id}>
          <ProductImage product={product} />
          <div className={s.productInfo}><div className={s.productNameRow}><strong>{product.name}</strong><span>{product.category}</span></div><p>{priceBasis(product)}</p><small>Available: {formatQuantity(product.quantity)} {product.unit}</small></div>
          <button type="button" className={s.addButton} disabled={stock <= 0} onClick={() => onAdd(product)}>{stock > 0 ? <><Icon name="plus" size={16} />Add</> : "Out of stock"}</button>
        </article>;
      }) : <div className={s.emptyResults}><Icon name="search" size={28} /><strong>{term ? "No matching products" : "No products to sell yet"}</strong><span>{term ? "Try a product name or scan the full barcode." : "Add products in Product Management to start a sale."}</span></div>}
    </div>
  </section>;
}
