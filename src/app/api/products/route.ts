import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nameProductImage } from "@/lib/product-images";
import { isMeasurementUnit, isPricingAmount } from "@/lib/product-pricing";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json(
      { error: "Unable to fetch products." },
      { status: 500 },
    );
  }
}

function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    return Number(value);
  }
  return NaN;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object." },
      { status: 400 },
    );
  }

  const { name, category, price, quantity, barcode, image, pricingAmount = 1, unit = "Pcs" } = body as Record<
    string,
    unknown
  >;

  if (
    typeof name !== "string" || !name.trim() ||
    typeof category !== "string" || !category.trim()
  ) {
    return NextResponse.json(
      { error: "Name and category are required and must be non-empty strings." },
      { status: 400 },
    );
  }

  const parsedPrice = parseNumber(price);
  const parsedQuantity = parseNumber(quantity);
  const parsedPricingAmount = parseNumber(pricingAmount);
  if (!isPricingAmount(parsedPricingAmount) || !isMeasurementUnit(unit)) {
    return NextResponse.json({ error: "Enter a pricing amount greater than zero and select a valid unit." }, { status: 400 });
  }

  if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
    return NextResponse.json(
      { error: "Price is required and must be a finite, non-negative number." },
      { status: 400 },
    );
  }

  if (
    !Number.isInteger(parsedQuantity) ||
    parsedQuantity < 0 || parsedQuantity > 2147483647
  ) {
    return NextResponse.json(
      { error: "Quantity is required and must be a whole number from 0 to 2147483647." },
      { status: 400 },
    );
  }

  if (
    (barcode != null && typeof barcode !== "string") ||
    (image != null && typeof image !== "string")
  ) {
    return NextResponse.json(
      { error: "Barcode and image must be strings or null when provided." },
      { status: 400 },
    );
  }

  try {
    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        category: category.trim(),
        price: parsedPrice,
        pricingAmount: parsedPricingAmount,
        unit,
        quantity: parsedQuantity,
        barcode: typeof barcode === "string" ? barcode.trim() || null : null,
        image: await nameProductImage(typeof image === "string" ? image.trim() || null : null, name.trim(), category.trim()),
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A product with this barcode already exists." },
        { status: 409 },
      );
    }

    console.error("Failed to create product:", error);
    return NextResponse.json(
      { error: "Unable to create product." },
      { status: 500 },
    );
  }
}
