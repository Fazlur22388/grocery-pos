"use client";

import { formatMoney, type PaymentMethod } from "./sales";
import s from "./sales.module.css";

export function PaymentPanel({ paymentMethod, amountTendered, total, disabled, onPaymentMethodChange, onAmountTenderedChange, onComplete }: { paymentMethod: PaymentMethod; amountTendered: string; total: number; disabled: boolean; onPaymentMethodChange: (method: PaymentMethod) => void; onAmountTenderedChange: (value: string) => void; onComplete: () => void }) {
  const tendered = Number(amountTendered);
  const change = Number.isFinite(tendered) ? tendered - total : 0;
  return <div className={s.paymentPanel}><div className={s.paymentTitle}><h3>Payment</h3><span>Final total: <b>Rs. {formatMoney(total)}</b></span></div><div className={s.paymentOptions} role="radiogroup" aria-label="Payment method"><button type="button" role="radio" aria-checked={paymentMethod === "CASH"} className={paymentMethod === "CASH" ? s.paymentActive : ""} onClick={() => onPaymentMethodChange("CASH")}>Cash</button><button type="button" role="radio" aria-checked={paymentMethod === "CARD"} className={paymentMethod === "CARD" ? s.paymentActive : ""} onClick={() => onPaymentMethodChange("CARD")}>Card</button></div>{paymentMethod === "CASH" ? <div className={s.cashFields}><label>Amount received<input aria-label="Amount received" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={amountTendered} onChange={event => onAmountTenderedChange(event.target.value)} /></label><div className={change >= 0 ? s.changeGood : s.changeDue}><span>Change due</span><strong>{change >= 0 ? `Rs. ${formatMoney(change)}` : `Rs. ${formatMoney(Math.abs(change))} short`}</strong></div></div> : <p className={s.cardNote}>Card payment selected. No cash amount or change is required.</p>}<button type="button" className={s.completeButton} onClick={onComplete} disabled={disabled}>{disabled ? "Completing sale…" : "Complete Sale"}</button></div>;
}
