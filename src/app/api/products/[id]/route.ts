import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nameProductImage } from "@/lib/product-images";
import { ApiError, apiErrorResponse, readBody, routeProductId } from "@/lib/api-errors";
import { productInput } from "@/lib/product-input";
import { serializeProduct } from "@/lib/serialization";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const id = routeProductId((await context.params).id);
    return Response.json(serializeProduct(await prisma.product.findUniqueOrThrow({ where: { id } })));
  } catch (error) { return apiErrorResponse(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const id = routeProductId((await context.params).id);
    const fields = await readBody(request);
    if (typeof fields.version !== "number" || !Number.isInteger(fields.version) || fields.version < 0) {
      throw new ApiError(400, "VERSION_REQUIRED", "Include the product version from your latest GET response.");
    }
    const supported = ["name", "category", "price", "pricingAmount", "unit", "quantity", "barcode", "image"];
    if (!supported.some(key => Object.hasOwn(fields, key))) throw new ApiError(400, "INVALID_INPUT", "Provide a product field to update.");
    const current = await prisma.product.findUniqueOrThrow({ where: { id } });
    const conflict = () => new ApiError(409, "PRODUCT_CHANGED", "This product changed since you opened it. Close the dialog, refresh the catalogue, and edit it again.");
    if (current.version !== fields.version) throw conflict();
    const data = productInput(fields, current);
    if (data.image !== current.image || data.name !== current.name || data.category !== current.category) {
      data.image = await nameProductImage(data.image, data.name, data.category);
    }
    // The conditional write also detects changes during validation or image I/O.
    try {
      const product = await prisma.product.update({
        where: { id, version: fields.version }, data: { ...data, version: { increment: 1 } },
      });
      return Response.json(serializeProduct(product));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") throw conflict();
      throw error;
    }
  } catch (error) { return apiErrorResponse(error); }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const id = routeProductId((await context.params).id);
    await prisma.product.delete({ where: { id } });
    return Response.json({ message: "Product deleted successfully." });
  } catch (error) { return apiErrorResponse(error); }
}
