"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import s from "./products.module.css";

export type ProductPhoto = { file: File | null; url: string | null };

function PhotoPreview({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={s.photoUnavailable}><Icon name="image" size={30} />Photo unavailable<span>Choose a new image below</span></span>;
  // Local blob previews and saved image URLs are displayed without an image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Product photo preview" onError={() => setFailed(true)} />;
}

export function ProductImagePicker({ photo, onChange, busy, checking, onChecking, name, category, price, pricingAmount, unit }: {
  photo: ProductPhoto;
  onChange: (photo: ProductPhoto) => void;
  busy: boolean;
  checking: boolean;
  onChecking: (checking: boolean) => void;
  name: string;
  category: string;
  price: string;
  pricingAmount: string;
  unit: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const selecting = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (photo.file && photo.url) URL.revokeObjectURL(photo.url);
  }, [photo]);

  async function choose(file?: File) {
    if (!file || busy || selecting.current) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please choose a JPG, PNG, or WebP image.");
      return;
    }
    if (!file.size || file.size > 5 * 1024 * 1024) {
      setError("Choose a non-empty image up to 5 MB.");
      return;
    }
    selecting.current = true;
    onChecking(true);
    try {
      // Check that the selected file can actually be decoded before accepting it.
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      onChange({ file, url: URL.createObjectURL(file) });
    } catch {
      setError("We couldn't open that image. Please choose another photo.");
    } finally {
      selecting.current = false;
      onChecking(false);
    }
  }

  const amount = Number(price);
  return <section className={s.photoPanel} aria-label="Product photo and live preview">
    <div className={s.photoHeading}><span>PRODUCT PHOTO</span><span>Optional</span></div>
    <input
      ref={input}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      aria-label="Choose product image"
      hidden
      disabled={busy || checking}
      onChange={event => {
        void choose(event.target.files?.[0]);
        event.target.value = "";
      }}
    />
    <button
      type="button"
      className={`${s.photoDrop} ${dragging ? s.photoDragging : ""} ${photo.url ? s.photoFilled : ""}`}
      aria-label={photo.url ? "Change product photo" : "Choose product photo from your computer"}
      disabled={busy || checking}
      onClick={() => input.current?.click()}
      onDragOver={event => { event.preventDefault(); if (!busy && !checking) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => {
        event.preventDefault(); setDragging(false);
        if (event.dataTransfer.files.length > 1) { setError("Choose one product photo at a time."); return; }
        void choose(event.dataTransfer.files[0]);
      }}
    >
      {photo.url ? <PhotoPreview key={photo.url} url={photo.url} /> : <>
        <span className={s.photoUploadIcon}><Icon name="image" size={34} /></span>
        <strong>Give your product a face</strong>
        <span>Click to choose a photo<br />or drag and drop it here</span>
        <span className={s.photoBrowse}><Icon name="plus" size={15} />Choose image</span>
      </>}
      {photo.url && <span className={s.photoOverlay}><Icon name="edit" size={14} />Change photo</span>}
    </button>
    <div className={s.photoCaption}>
      <span className={s.photoPreviewLabel}>LIVE PRODUCT PREVIEW</span>
      <strong>{name.trim() || "Your product name"}</strong>
      <span>{category.trim() || "Product category"}</span>
      <b>Rs. {(Number.isFinite(amount) && amount >= 0 ? amount : 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
      <span>per {pricingAmount || "—"} {unit}</span>
    </div>
    {photo.url && <div className={s.photoControls}>
      <button type="button" className={s.secondary} onClick={() => input.current?.click()} disabled={busy || checking}><Icon name="upload" size={14} />Replace</button>
      <button type="button" className={`${s.iconButton} ${s.deleteAction}`} aria-label="Remove product photo" title="Remove photo" disabled={busy || checking} onClick={() => { onChange({ file: null, url: null }); setError(""); }}><Icon name="trash" size={17} /></button>
    </div>}
    <p className={s.photoFileName}>{photo.file?.name || "JPG, PNG or WebP · Up to 5 MB"}</p>
    <p className={s.photoNote} role="status">{checking ? "Checking your photo…" : photo.file ? "Ready to save with your product" : "Photos stay on this computer"}</p>
    {error && <p className={s.photoError} role="alert">{error}</p>}
  </section>;
}
