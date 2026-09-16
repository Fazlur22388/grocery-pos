import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

// Store shop data outside public/ so uploads also work after a production build.
export const productImageDirectory = path.join(process.cwd(), "data", "product-images");
export const maxImageBytes = 5 * 1024 * 1024;
export const imageMimeTypes: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function productImageMatch(filename: string) {
  return /^[\p{L}\p{N}][\p{L}\p{N}\p{M} _()-]{0,160}\.(jpg|png|webp)$/u.exec(filename);
}

export async function saveProductImage(bytes: Buffer, extension: string, name: string, category: string) {
  let stem = `${name} ${category}`.normalize("NFC").toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M} _()-]/gu, " ")
    .replace(/\s+/g, " ").replace(/^[^\p{L}\p{N}]+/u, "").trim().slice(0, 120).trim() || "product";
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(stem)) stem = `product ${stem}`;
  await mkdir(productImageDirectory, { recursive: true });
  for (let suffix = 1; ; suffix++) {
    const filename = `${stem}${suffix === 1 ? "" : ` (${suffix})`}.${extension}`;
    const target = path.join(productImageDirectory, filename);
    try {
      // Never overwrite another photo or change an already cached image URL.
      await writeFile(target, bytes, { flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (!(await readFile(target)).equals(bytes)) continue;
    }
    return `/api/product-images/${encodeURIComponent(filename)}`;
  }
}

export async function nameProductImage(image: string | null, name: string, category: string) {
  if (!image?.startsWith("/api/product-images/")) return image;
  let filename: string;
  try { filename = decodeURIComponent(image.slice("/api/product-images/".length)); }
  catch { throw new Error("Invalid product image URL."); }
  const match = productImageMatch(filename);
  if (!match) throw new Error("Invalid product image filename.");
  const bytes = await readFile(path.join(productImageDirectory, filename));
  // Keep the source: another product may share it, or the database save may fail.
  return saveProductImage(bytes, match[1], name, category);
}

export function imageExtension(bytes: Uint8Array): string | null {
  const buffer = Buffer.from(bytes);
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}
