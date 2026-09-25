"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/products/icon";
import { productRequest, type Product } from "@/components/products/product";
import { Cart } from "./cart";
import { PaymentPanel } from "./payment-panel";
import { ProductSearch } from "./product-search";
import { cartSubtotal, formatMoney, normaliseQuantity, type CartItem, type PaymentMethod, type SaleResult } from "./sales";
import s from "./sales.module.css";

const navigation: { label: string; icon: IconName; href?: string }[] = [
  { label: "Dashboard", icon: "grid" }, { label: "Products", icon: "box", href: "/" }, { label: "Sales", icon: "cart", href: "/sales" }, { label: "Inventory", icon: "stock" }, { label: "Reports", icon: "chart" }, { label: "Settings", icon: "settings" },
];

function createRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `sale-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function SalesScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [discount, setDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [amountTendered, setAmountTendered] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SaleResult["sale"] | null>(null);
  const submitRef = useRef(false);
  const checkoutRequestId = useRef<string | null>(null);

  async function loadProducts() {
    setLoadingProducts(true);
    try { setProducts(await productRequest<Product[]>("/api/products")); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load products."); }
    finally { setLoadingProducts(false); }
  }
  useEffect(() => { void loadProducts(); }, []);

  function addProduct(product: Product) {
    checkoutRequestId.current = null;
    if (Number(product.quantity) <= 0) { setFeedback(`${product.name} is out of stock.`); return; }
    setCart(items => {
      const existing = items.find(item => item.product.id === product.id);
      const defaultQuantity = product.unit === "Pcs" || product.unit === "Pkt" || product.unit === "Bottle" ? 1 : Number(product.pricingAmount);
      if (!existing) return [...items, { product, quantity: normaliseQuantity(defaultQuantity, product) }];
      const quantity = normaliseQuantity(existing.quantity + defaultQuantity, product);
      if (quantity === existing.quantity) setFeedback(`Only ${product.quantity} ${product.unit} of ${product.name} is available.`);
      return items.map(item => item.product.id === product.id ? { ...item, product, quantity } : item);
    });
    setFeedback(`${product.name} added to the bill.`);
  }
  function updateQuantity(id: number, quantity: number) { checkoutRequestId.current = null; setCart(items => items.flatMap(item => item.product.id !== id ? [item] : quantity > 0 ? [{ ...item, quantity: normaliseQuantity(quantity, item.product) }] : [])); }
  function removeProduct(id: number) { checkoutRequestId.current = null; setCart(items => items.filter(item => item.product.id !== id)); }
  function clearCart() { checkoutRequestId.current = null; setCart([]); setDiscount(""); setAmountTendered(""); setError(""); }
  function changeDiscount(value: string) { checkoutRequestId.current = null; setDiscount(value); }
  function changePaymentMethod(method: PaymentMethod) { checkoutRequestId.current = null; setPaymentMethod(method); }
  function changeAmountTendered(value: string) { checkoutRequestId.current = null; setAmountTendered(value); }
  async function addBarcode() {
    const barcode = query.trim();
    if (!barcode) return;
    setFeedback("");
    try {
      const product = await productRequest<Product>(`/api/products/by-barcode/${encodeURIComponent(barcode)}`);
      addProduct(product); setQuery("");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Barcode lookup failed.";
      setFeedback(message === "No product matches this barcode." ? "No exact barcode match. Choose a matching product from the list if appropriate." : message);
    }
  }
  const subtotal = cartSubtotal(cart);
  const enteredDiscount = Number(discount);
  const validDiscount = Number.isFinite(enteredDiscount) ? Math.min(Math.max(0, enteredDiscount), subtotal) : 0;
  const total = Math.max(0, subtotal - validDiscount);
  async function completeSale() {
    if (submitRef.current) return;
    setError("");
    if (!cart.length) { setError("Add at least one product before completing the sale."); return; }
    if (discount && (!Number.isFinite(enteredDiscount) || enteredDiscount < 0 || enteredDiscount > subtotal)) { setError("Enter a discount from Rs. 0.00 up to the subtotal."); return; }
    const tendered = Number(amountTendered);
    if (paymentMethod === "CASH" && (!Number.isFinite(tendered) || tendered < total)) { setError("Amount received must cover the final total for a cash sale."); return; }
    submitRef.current = true; setSubmitting(true);
    try {
      checkoutRequestId.current ??= createRequestId();
      const result = await productRequest<SaleResult>("/api/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: checkoutRequestId.current, items: cart.map(item => ({ productId: item.product.id, quantity: String(item.quantity) })), discount: String(validDiscount), paymentMethod, ...(paymentMethod === "CASH" ? { amountTendered: String(tendered) } : {}) }) });
      setSuccess(result.sale); clearCart(); setQuery(""); await loadProducts();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to complete this sale.");
      await loadProducts();
    } finally { submitRef.current = false; setSubmitting(false); }
  }
  function newSale() { checkoutRequestId.current = null; setSuccess(null); setError(""); setFeedback(""); setPaymentMethod("CASH"); setAmountTendered(""); setDiscount(""); }

  return <div className={s.app}><aside className={s.sidebar}><div className={s.brand}><span className={s.brandMark}><Icon name="shop" size={25} /></span><div>Grocery <b>POS</b><small>YOUR EVERYDAY STORE COMPANION</small></div></div><span className={s.navLabel}>WORKSPACE</span><nav aria-label="Main navigation">{navigation.map(item => item.href ? <Link key={item.label} href={item.href} className={item.label === "Sales" ? s.activeNav : ""} aria-current={item.label === "Sales" ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span>{item.label === "Sales" && <span className={s.activeDot} />}</Link> : <button key={item.label} disabled title="Coming soon"><Icon name={item.icon} /><span>{item.label}</span></button>)}</nav><div className={s.sidebarBottom}><div className={s.localNote}><Icon name="shop" size={18} /><div>Made for your shop<small>Local workspace · LKR</small></div></div><div className={s.version}><span>Grocery POS</span><span>v0.1</span></div></div></aside><div className={s.workspace}><header className={s.header}><div className={s.breadcrumb}>Workspace <Icon name="right" size={13} /><strong>Sales</strong></div><div className={s.headerRight}><span className={s.currency}>LKR <span>·</span> Sri Lanka</span><span className={s.storeAvatar}><Icon name="shop" size={18} /></span></div></header><main className={s.main}>{success ? <section className={s.successPanel} aria-live="polite"><span className={s.successIcon}><Icon name="check" size={35} /></span><div className={s.eyebrow}>PAYMENT CONFIRMED</div><h1>Sale completed<span>.</span></h1><p>Invoice <b>{success.invoiceNumber}</b> has been saved and the stock has been updated.</p><div className={s.receiptSummary}><div><span>Invoice</span><strong>{success.invoiceNumber}</strong></div><div><span>Payment</span><strong>{success.paymentMethod === "CASH" ? "Cash" : "Card"}</strong></div><div><span>Total</span><strong>Rs. {formatMoney(success.total)}</strong></div>{success.paymentMethod === "CASH" && <div><span>Change due</span><strong>Rs. {formatMoney(success.changeDue ?? 0)}</strong></div>}</div><button type="button" className={s.completeButton} onClick={newSale}><Icon name="plus" size={18} />New Sale</button></section> : <><div className={s.pageHeading}><div><div className={s.eyebrow}>FAST, ACCURATE CHECKOUT</div><h1>New Sale<span>.</span></h1><p>Scan products, build the bill, and complete payment.</p></div><span className={s.saleStatus}><i />Live inventory</span></div>{error && <div className={s.error} role="alert"><Icon name="alert" size={18} /><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error"><Icon name="close" size={15} /></button></div>}<div className={s.posLayout}><ProductSearch query={query} products={products} loading={loadingProducts} feedback={feedback} onQueryChange={value => { setQuery(value); setFeedback(""); }} onScan={() => void addBarcode()} onAdd={addProduct} /><aside className={s.billPanel}><Cart items={cart} subtotal={subtotal} discount={discount} total={total} onQuantityChange={updateQuantity} onRemove={removeProduct} onClear={clearCart} onDiscountChange={changeDiscount} /><PaymentPanel paymentMethod={paymentMethod} amountTendered={amountTendered} total={total} disabled={submitting || !cart.length} onPaymentMethodChange={changePaymentMethod} onAmountTenderedChange={changeAmountTendered} onComplete={() => void completeSale()} /></aside></div></>}</main></div></div>;
}
