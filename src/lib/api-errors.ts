import { Prisma } from "@prisma/client";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return Response.json({ error: "A product with this barcode already exists.", code: "DUPLICATE_BARCODE" }, { status: 409 });
    if (error.code === "P2025") return Response.json({ error: "Product not found.", code: "PRODUCT_NOT_FOUND" }, { status: 404 });
    if (["P1008", "P2028", "P2034"].includes(error.code)) {
      return Response.json({ error: "The database is busy. Retry with the same request ID.", code: "DATABASE_BUSY" }, { status: 503 });
    }
  }
  console.error("Database operation failed:", error);
  return Response.json({ error: "Unable to complete the operation. Please try again.", code: "INTERNAL_ERROR" }, { status: 500 });
}

export function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "INVALID_INPUT", "Request body must be a JSON object.");
  return value as Record<string, unknown>;
}

export async function readBody(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { throw new ApiError(400, "INVALID_JSON", "Invalid JSON body."); }
  return objectBody(body);
}

export function productId(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 2147483647) {
    throw new ApiError(400, "INVALID_PRODUCT_ID", "Product ID must be a positive integer.");
  }
  return value;
}

export function routeProductId(value: string) {
  return productId(/^\d+$/.test(value) ? Number(value) : NaN);
}
