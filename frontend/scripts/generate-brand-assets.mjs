import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const brandDir = path.join(root, "public", "brand");
const iconsDir = path.join(root, "public", "icons");
const source = await readFile(path.join(brandDir, "getneba-logo-source.svg"), "utf8");
const paths = source.split(/\r?\n/).filter((line) => line.startsWith("<path"));

function svg(viewBox, selectedPaths) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img">${selectedPaths.join("")}</svg>`;
}

// The generated source contains a horizontal lockup and a separate compact mark.
// Keep these crops reproducible so every browser and PWA asset uses the same artwork.
const wordmark = svg("340 730 1380 320", [...paths.slice(5, 21), ...paths.slice(23, 25)]);
const mark = svg("850 1360 340 340", [...paths.slice(1, 5), ...paths.slice(21, 23)]);

await writeFile(path.join(brandDir, "getneba-wordmark.svg"), wordmark);
await writeFile(path.join(brandDir, "getneba-mark.svg"), mark);

async function squareIcon(size, filename, markScale, background = "#f8faf8") {
  const markSize = Math.round(size * markScale);
  const renderedMark = await sharp(Buffer.from(mark)).resize(markSize, markSize).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: renderedMark, left: Math.round((size - markSize) / 2), top: Math.round((size - markSize) / 2) }])
    .png()
    .toFile(path.join(iconsDir, filename));
}

await Promise.all([
  squareIcon(32, "getneba-32.png", 0.78),
  squareIcon(180, "getneba-apple-180.png", 0.72),
  squareIcon(192, "getneba-192.png", 0.72),
  squareIcon(512, "getneba-512.png", 0.72),
  squareIcon(512, "getneba-maskable-512.png", 0.56, "#087f5b"),
  sharp(path.join(brandDir, "getneba-social-preview.png"))
    .resize(1200, 630, { fit: "contain", background: "#f8faf8" })
    .png()
    .toFile(path.join(brandDir, "getneba-social-preview-1200x630.png")),
]);
