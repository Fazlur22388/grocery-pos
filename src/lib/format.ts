// Display only: authoritative monetary arithmetic lives in the server Decimal helpers.
export function formatMoney(value: string | number) {
  const amount = Number(value);
  return (Number.isFinite(amount) ? amount : 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatQuantity(value: string) {
  return Number(value).toLocaleString("en-LK", { maximumFractionDigits: 3 });
}
