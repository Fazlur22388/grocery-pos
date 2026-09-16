"use client";

import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { Icon } from "./icon";
import { productRequest, type Product } from "./product";
import { measurementUnits, isMeasurementUnit, isPricingAmount, isDiscreteUnit } from "@/lib/product-pricing";
import { ProductImagePicker, type ProductPhoto } from "./product-image-picker";
import s from "./products.module.css";

export function Dialog({ title, subtitle, busy, onClose, children, wide = false }: { title: string; subtitle: string; busy: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`${s.dialog} ${wide ? s.productDialog : ""}`} aria-labelledby="dialog-title" aria-describedby="dialog-description" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <div className={s.dialogHeader}><div><h2 id="dialog-title">{title}</h2><p id="dialog-description">{subtitle}</p></div><button className={s.iconButton} type="button" aria-label="Close dialog" onClick={onClose} disabled={busy}><Icon name="close" /></button></div>
    {children}
  </dialog>;
}

export function ProductDialog({ product, categories, onClose, onSaved }: { product: Product | null; categories: string[]; onClose: () => void; onSaved: (product: Product) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<ProductPhoto>({ file: null, url: product?.image ?? null });
  const [checking, setChecking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState({ name: product?.name ?? "", category: product?.category ?? "", price: String(product?.price ?? ""), pricingAmount: String(product?.pricingAmount ?? 1), unit: product?.unit ?? "Pcs" });
  const uploaded = useRef<{ file: File; url: string } | null>(null);
  const lock = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || checking) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const category = String(form.get("category") ?? "").trim();
    const priceText = String(form.get("price") ?? "").trim();
    const quantityText = String(form.get("quantity") ?? "").trim();
    const price = Number(priceText), quantity = Number(quantityText);
    const pricingAmount = Number(form.get("pricingAmount"));
    const unit = String(form.get("unit") ?? "");
    if (!isPricingAmount(pricingAmount) || !isMeasurementUnit(unit)) {
      setError("Enter a pricing amount greater than zero and select a unit.");
      return;
    }
    if (!name || !category || !priceText || !quantityText || !Number.isFinite(price) || price < 0 || !Number.isFinite(quantity) || quantity < 0 || (isDiscreteUnit(unit) && !Number.isInteger(quantity))) {
      setError("Enter valid pricing and stock. Pcs, Pkt and Bottle stock must be whole numbers.");
      return;
    }
    lock.current = true; setBusy(true); setError("");
    try {
      let image = photo.url;
      if (photo.file) {
        if (uploaded.current?.file !== photo.file) {
          setUploading(true);
          const result = await productRequest<{ image: string }>(`/api/product-images?${new URLSearchParams({ name, category })}`, {
            method: "POST",
            headers: { "Content-Type": photo.file.type },
            body: photo.file,
          });
          uploaded.current = { file: photo.file, url: result.image };
        }
        image = uploaded.current.url;
        setUploading(false);
      }
      const saved = await productRequest<Product>(product ? `/api/products/${product.id}` : "/api/products", {
        method: product ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, price: priceText, pricingAmount: String(form.get("pricingAmount") ?? "").trim(), unit, quantity: quantityText, ...(product ? { version: product.version } : {}), barcode: String(form.get("barcode") ?? "").trim() || null, image }),
      });
      onSaved(saved);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save product."); }
    finally { lock.current = false; setBusy(false); setUploading(false); }
  }
  return <Dialog wide title={product ? "Edit product" : "Add a product"} subtitle={product ? "Update the details in your product catalogue." : "A new addition to your shop starts here."} busy={busy || checking} onClose={onClose}>
    <form onSubmit={submit} onChange={event => {
      const form = new FormData(event.currentTarget);
      setPreview({ name: String(form.get("name") ?? ""), category: String(form.get("category") ?? ""), price: String(form.get("price") ?? ""), pricingAmount: String(form.get("pricingAmount") ?? ""), unit: String(form.get("unit") ?? "Pcs") });
    }}>
      <div className={s.productEditor}>
      <ProductImagePicker photo={photo} onChange={setPhoto} busy={busy} checking={checking} onChecking={setChecking} {...preview} />
      <fieldset disabled={busy} className={s.formFields}>
        {error && <div className={s.error} role="alert"><Icon name="alert" />{error}</div>}
        <p className={s.formSection}>PRODUCT DETAILS</p>
        <label>Product name <span>*</span><input name="name" required autoFocus defaultValue={product?.name} placeholder="e.g. Keeri Samba Rice 1 kg" /></label>
        <label>Category <span>*</span><input name="category" required list="product-categories" defaultValue={product?.category} placeholder="Select or enter a category" /><datalist id="product-categories">{categories.map(c => <option key={c} value={c} />)}</datalist></label>
        <p className={s.formSection}>PRICING</p>
        <div className={s.formGrid}>
          <label>Pricing amount <span>*</span><input name="pricingAmount" type="number" required min="0.001" max="999999999.999" step="0.001" defaultValue={product?.pricingAmount ?? 1} placeholder="e.g. 1 or 100" aria-describedby="pricing-hint" /></label>
          <label>Unit <span>*</span><select name="unit" required defaultValue={product?.unit ?? "Pcs"}>{measurementUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></label>
        </div>
        <label>Unit price (Rs.) <span>*</span><input name="price" type="number" required min="0" max="999999999.99" step="0.01" defaultValue={product?.price} placeholder="0.00" aria-describedby="pricing-hint" /></label>
        <p id="pricing-hint" className={s.fieldHint}>Price for the amount above. For cashews at Rs. 700 per 100 g, enter 100, g, and 700.</p>
        <label>Stock quantity ({preview.unit}) <span>*</span><input name="quantity" type="number" required min="0" max="999999999.999" step={isDiscreteUnit(preview.unit) ? "1" : "0.001"} defaultValue={product?.quantity ?? 0} /></label>
        <p className={s.fieldHint}>Stock is measured in {preview.unit}. Changing the unit does not convert existing stock.</p>
        <label>Barcode <small>Optional</small><input name="barcode" defaultValue={product?.barcode ?? ""} placeholder="Scan or enter barcode" /></label>
        <p className={s.fieldHint}>A barcode helps you find this product quickly at the counter.</p>
      </fieldset>
      </div>
      <div className={s.dialogFooter}><button type="button" className={s.secondary} disabled={busy || checking} onClick={onClose}>Cancel</button><button type="submit" className={s.primary} disabled={busy || checking}>{checking ? "Checking photo…" : uploading ? "Saving photo…" : busy ? "Saving…" : product ? "Save changes" : "Add product"}</button></div>
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
