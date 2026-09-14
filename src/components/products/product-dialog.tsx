"use client";

import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { Icon } from "./icon";
import { productRequest, type Product } from "./product";
import s from "./products.module.css";

export function Dialog({ title, subtitle, busy, onClose, children }: { title: string; subtitle: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={s.dialog} aria-labelledby="dialog-title" aria-describedby="dialog-description" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <div className={s.dialogHeader}><div><h2 id="dialog-title">{title}</h2><p id="dialog-description">{subtitle}</p></div><button className={s.iconButton} type="button" aria-label="Close dialog" onClick={onClose} disabled={busy}><Icon name="close" /></button></div>
    {children}
  </dialog>;
}

export function ProductDialog({ product, categories, onClose, onSaved }: { product: Product | null; categories: string[]; onClose: () => void; onSaved: (product: Product) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const category = String(form.get("category") ?? "").trim();
    const priceText = String(form.get("price") ?? "").trim();
    const quantityText = String(form.get("quantity") ?? "").trim();
    const price = Number(priceText), quantity = Number(quantityText);
    if (!name || !category || !priceText || !quantityText || !Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 0 || quantity > 2147483647) {
      setError("Enter a name, category, valid non-negative price, and a whole stock quantity from 0 to 2147483647.");
      return;
    }
    lock.current = true; setBusy(true); setError("");
    try {
      const saved = await productRequest<Product>(product ? `/api/products/${product.id}` : "/api/products", {
        method: product ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, price, quantity, barcode: String(form.get("barcode") ?? "").trim() || null, image: String(form.get("image") ?? "").trim() || null }),
      });
      onSaved(saved);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save product."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Dialog title={product ? "Edit product" : "Add a product"} subtitle={product ? "Update the details in your product catalogue." : "A new addition to your shop starts here."} busy={busy} onClose={onClose}>
    <form onSubmit={submit}>
      <fieldset disabled={busy} className={s.formFields}>
        {error && <div className={s.error} role="alert"><Icon name="alert" />{error}</div>}
        <p className={s.formSection}>PRODUCT DETAILS</p>
        <label>Product name <span>*</span><input name="name" required autoFocus defaultValue={product?.name} placeholder="e.g. Keeri Samba Rice 1 kg" /></label>
        <label>Category <span>*</span><input name="category" required list="product-categories" defaultValue={product?.category} placeholder="Select or enter a category" /><datalist id="product-categories">{categories.map(c => <option key={c} value={c} />)}</datalist></label>
        <div className={s.formGrid}><label>Price (Rs.) <span>*</span><input name="price" type="number" required min="0" step="any" defaultValue={product?.price} placeholder="0.00" /></label><label>Quantity <span>*</span><input name="quantity" type="number" required min="0" max="2147483647" step="1" defaultValue={product?.quantity ?? 0} /></label></div>
        <label>Barcode <small>Optional</small><input name="barcode" defaultValue={product?.barcode ?? ""} placeholder="Scan or enter barcode" /></label>
        <label>Image URL or path <small>Optional</small><input name="image" defaultValue={product?.image ?? ""} placeholder="/products/rice.jpg" aria-describedby="image-help" /></label>
        <p id="image-help" className={s.fieldHint}>Use an existing image address. Leave blank for a product placeholder.</p>
      </fieldset>
      <div className={s.dialogFooter}><button type="button" className={s.secondary} disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className={s.primary} disabled={busy}>{busy ? "Saving…" : product ? "Save changes" : "Add product"}</button></div>
    </form>
  </Dialog>;
}

export function DeleteDialog({ product, onClose, onDeleted }: { product: Product; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function remove() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await productRequest(`/api/products/${product.id}`, { method: "DELETE" }); onDeleted(); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to delete product."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Dialog title="Delete product?" subtitle="This action cannot be undone." busy={busy} onClose={onClose}>
    <div className={s.deleteBody}><span className={s.deleteSymbol}><Icon name="trash" size={26} /></span><p><strong>{product.name}</strong> will be permanently removed from your product catalogue.</p>{error && <div className={s.error} role="alert">{error}</div>}</div>
    <div className={s.dialogFooter}><button className={s.secondary} disabled={busy} onClick={onClose} autoFocus>Keep product</button><button className={s.danger} disabled={busy} onClick={remove}>{busy ? "Deleting…" : "Delete product"}</button></div>
  </Dialog>;
}
