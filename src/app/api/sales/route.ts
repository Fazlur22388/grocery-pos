import { prisma } from "@/lib/prisma";
import { apiErrorResponse, readBody } from "@/lib/api-errors";
import { completeSale } from "@/lib/sales";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const result = await completeSale(prisma, await readBody(request));
    return Response.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) { return apiErrorResponse(error); }
}
