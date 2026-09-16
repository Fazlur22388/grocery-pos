export type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  pricingAmount: number;
  unit: string;
  quantity: number;
  barcode: string | null;
  image: string | null;
  createdAt: string;
  updatedAt: string;
};

export const defaultCategories = ["Rice", "Sweets", "Meat", "Beverages", "Grocery", "Other"];

export async function productRequest<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...options });
  } catch {
    throw new Error("Could not reach the local server. Check that Grocery POS is running and try again.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "The request failed. Please try again.");
  if (data === null) throw new Error("The server returned an unexpected response. Please try again.");
  return data as T;
}
