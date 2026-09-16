import { readFile } from "node:fs/promises";
import path from "node:path";
import { imageMimeTypes, productImageMatch } from "@/lib/product-images";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  // Never accept a user-supplied filesystem path.
  const match = productImageMatch(filename);
  if (!match) return Response.json({ error: "Image not found." }, { status: 404 });

  try {
    const bytes = await readFile(path.join(process.cwd(), "data", "product-images", filename));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": imageMimeTypes[match[1]],
        "Content-Length": String(bytes.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json({ error: "Image not found." }, { status: 404 });
    }
    console.error("Unable to read product image:", error);
    return Response.json({ error: "Unable to load this image." }, { status: 500 });
  }
}
