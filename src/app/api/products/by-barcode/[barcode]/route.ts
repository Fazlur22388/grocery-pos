import { prisma } from "@/lib/prisma";
import { apiErrorResponse, ApiError } from "@/lib/api-errors";
import { serializeProduct } from "@/lib/serialization";

export async function GET(_request: Request, context: { params: Promise<{ barcode: string }> }) {
  try {
    const { barcode } = await context.params;
    const product = await prisma.product.findUnique({ where: { barcode } });
    if (!product) throw new ApiError(404, "PRODUCT_NOT_FOUND", "No product matches this barcode.");
    return Response.json(serializeProduct(product));
  } catch (error) { return apiErrorResponse(error); }
}
