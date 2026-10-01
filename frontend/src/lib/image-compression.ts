const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const TARGET_MAX_BYTES = 1.5 * 1024 * 1024;
const HARD_MAX_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 1600;
const MIN_EDGE = 200;
const compressedFiles = new WeakSet<File>();

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This image could not be read. Choose a valid JPEG, PNG, or WebP photo."));
    };
    image.src = url;
  });
}

function getBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

export async function compressImage(file: File): Promise<File> {
  if (compressedFiles.has(file)) return file;
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Choose an image under 20 MB.");
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP photo.");
  }

  try {
    const image = await loadImage(file);

    if (image.naturalWidth < MIN_EDGE || image.naturalHeight < MIN_EDGE) {
      throw new Error(`Use a clear photo that is at least ${MIN_EDGE}×${MIN_EDGE} pixels.`);
    }

    let scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const minDim = Math.min(image.naturalWidth, image.naturalHeight);
    if (minDim >= MIN_EDGE && minDim * scale < MIN_EDGE) {
      scale = MIN_EDGE / minDim;
    }

    const width = Math.max(MIN_EDGE, Math.round(image.naturalWidth * scale));
    const height = Math.max(MIN_EDGE, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This image could not be compressed.");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);

    // Prefer modern WebP; fall back to JPEG if browser doesn't support WebP canvas encoding
    let mimeType = "image/webp";
    let ext = "webp";
    let quality = 0.82;
    let blob = await getBlob(canvas, mimeType, quality);

    if (!blob || blob.type !== "image/webp") {
      mimeType = "image/jpeg";
      ext = "jpg";
      quality = 0.82;
      blob = await getBlob(canvas, mimeType, quality);
    }

    if (!blob) throw new Error("This image could not be compressed.");

    // Adaptively decrease quality if still exceeding target size
    while (blob.size > TARGET_MAX_BYTES && quality > 0.5) {
      quality -= 0.08;
      const nextBlob = await getBlob(canvas, mimeType, quality);
      if (nextBlob) {
        blob = nextBlob;
      }
    }

    if (blob.size > HARD_MAX_BYTES) {
      throw new Error("This image is still too large after compression. Choose a smaller photo.");
    }

    const baseName = file.name.replace(/\.[^.]+$/, "").trim() || "profile";
    const compressed = new File([blob], `${baseName}.${ext}`, { type: mimeType, lastModified: Date.now() });
    compressedFiles.add(compressed);
    return compressed;
  } catch (error) {
    if (error instanceof Error && (error.message.includes("MB") || error.message.includes("pixels") || error.message.includes("Choose"))) {
      throw error;
    }
    throw new Error("This image could not be compressed. Try another JPEG or PNG photo.");
  }
}
