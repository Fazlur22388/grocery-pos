import { imageExtension, imageMimeTypes, maxImageBytes, saveProductImage } from "@/lib/product-images";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const params = new URL(request.url).searchParams;
  const name = params.get("name")?.trim();
  const category = params.get("category")?.trim();
  if (!name || !category) return Response.json({ error: "Name and category are required for the photo." }, { status: 400 });
  const mime = request.headers.get("content-type")?.split(";")[0];
  if (!mime || !Object.values(imageMimeTypes).includes(mime)) {
    return Response.json({ error: "Choose a JPG, PNG, or WebP image." }, { status: 415 });
  }
  if (Number(request.headers.get("content-length")) > maxImageBytes) {
    return Response.json({ error: "Choose an image smaller than 5 MB." }, { status: 413 });
  }
  if (!request.body) return Response.json({ error: "No image was provided." }, { status: 400 });

  try {
    // Enforce the limit even when Content-Length is missing or incorrect.
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maxImageBytes) {
          await reader.cancel();
          return Response.json({ error: "Choose an image smaller than 5 MB." }, { status: 413 });
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const bytes = Buffer.concat(chunks);
    const extension = imageExtension(bytes);
    if (!extension || imageMimeTypes[extension] !== mime) {
      return Response.json({ error: "This file is not a supported image. Choose a JPG, PNG, or WebP photo." }, { status: 400 });
    }
    const image = await saveProductImage(bytes, extension, name, category);
    return Response.json({ image }, { status: 201 });
  } catch (error) {
    console.error("Unable to store product image:", error);
    return Response.json({ error: "The photo could not be saved on this computer. Please try again." }, { status: 500 });
  }
}
