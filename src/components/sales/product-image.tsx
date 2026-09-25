"use client";

import { useState } from "react";
import { Icon } from "@/components/products/icon";
import type { Product } from "@/components/products/product";
import s from "./sales.module.css";

export function ProductImage({ product, compact = false }: { product: Product; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <span className={`${s.productImage} ${compact ? s.compactImage : ""}`}>
    {product.image && !failed ? (
      // Product images can be local paths or remote URLs selected in Product Management.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={product.image} alt="" loading="lazy" onError={() => setFailed(true)} />
    ) : <Icon name="box" size={compact ? 18 : 23} />}
  </span>;
}
