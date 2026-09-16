import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nameProductImage } from "@/lib/product-images";
import { isMeasurementUnit, isPricingAmount } from "@/lib/product-pricing";

type Context = { params: Promise<{ id: string }> };

function parseId(value: string): number | null {
  const id = Number(value);
  return /^\d+$/.test(value) && Number.isInteger(id) && id > 0 && id <= 2147483647
    ? id
    : null;
}

function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

function databaseError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A product with this barcode already exists." },
        { status: 409 },
      );
    }
  }
  console.error("Product database operation failed:", error);
  return NextResponse.json(
    { error: "Unable to complete the product operation." },
    { status: 500 },
  );
}

export async function GET(_request: Request, context: Context) {
  const id = parseId((await context.params).id);
  if (id === null) {
    return NextResponse.json({ error: "Invalid product ID." }, { status: 400 });
  }

  try {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch (error) {
    return databaseError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  const id = parseId((await context.params).id);
  if (id === null) {
    return NextResponse.json({ error: "Invalid product ID." }, { status: 400 });
  }

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

  const fields = body as Record<string, unknown>;
  const data: Prisma.ProductUpdateInput = {};

  for (const field of ["name", "category"] as const) {
    if (Object.hasOwn(fields, field)) {
      const value = fields[field];
      if (typeof value !== "string" || !value.trim()) {
        return NextResponse.json(
          { error: `${field} must be a non-empty string.` },
          { status: 400 },
        );
      }
      data[field] = value.trim();
    }
  }

  if (Object.hasOwn(fields, "pricingAmount")) {
    const pricingAmount = parseNumber(fields.pricingAmount);
    if (!isPricingAmount(pricingAmount)) {
      return NextResponse.json({ error: "Pricing amount must be a finite number greater than zero." }, { status: 400 });
    }
    data.pricingAmount = pricingAmount;
  }
  if (Object.hasOwn(fields, "unit")) {
    if (!isMeasurementUnit(fields.unit)) {
      return NextResponse.json({ error: "Select a valid measurement unit." }, { status: 400 });
    }
    data.unit = fields.unit;
  }

  if (Object.hasOwn(fields, "price")) {
    const price = parseNumber(fields.price);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json(
        { error: "Price must be a finite, non-negative number." },
        { status: 400 },
      );
    }
    data.price = price;
  }

  if (Object.hasOwn(fields, "quantity")) {
    const quantity = parseNumber(fields.quantity);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 2147483647) {
      return NextResponse.json(
        { error: "Quantity must be a whole number from 0 to 2147483647." },
        { status: 400 },
      );
    }
    data.quantity = quantity;
  }

  for (const field of ["barcode", "image"] as const) {
    if (Object.hasOwn(fields, field)) {
      const value = fields[field];
      if (value !== null && typeof value !== "string") {
        return NextResponse.json(
          { error: `${field} must be a string or null.` },
          { status: 400 },
        );
      }
      data[field] = typeof value === "string" ? value.trim() || null : null;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Provide at least one supported product field to update." },
      { status: 400 },
    );
  }

  try {
    const current = await prisma.product.findUniqueOrThrow({ where: { id } });
    data.image = await nameProductImage(
      data.image === undefined ? current.image : data.image as string | null,
      typeof data.name === "string" ? data.name : current.name,
      typeof data.category === "string" ? data.category : current.category,
    );
    const product = await prisma.product.update({ where: { id }, data });
    return NextResponse.json(product);
  } catch (error) {
    return databaseError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const id = parseId((await context.params).id);
  if (id === null) {
    return NextResponse.json({ error: "Invalid product ID." }, { status: 400 });
  }

  try {
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ message: "Product deleted successfully." });
  } catch (error) {
    return databaseError(error);
  }
}
