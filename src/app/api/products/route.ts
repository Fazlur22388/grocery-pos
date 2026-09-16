import { prisma } from "@/lib/prisma";
import { nameProductImage } from "@/lib/product-images";
import { apiErrorResponse, readBody } from "@/lib/api-errors";
import { productInput } from "@/lib/product-input";
import { serializeProduct } from "@/lib/serialization";

export async function GET() {
  try {
    const products = await prisma.product.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    return Response.json(products.map(serializeProduct));
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const data = productInput(await readBody(request));
    data.image = await nameProductImage(data.image, data.name, data.category);
    const product = await prisma.product.create({ data });
    return Response.json(serializeProduct(product), { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
