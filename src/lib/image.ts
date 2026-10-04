// Shrinks a picture in the browser before it is sent for reading: phone photos are several MB and the request has a size limit.
// Output is always JPEG (white behind transparent PNGs), longest side at most 1600 px.

export interface PreparedImage {
  /** base64 without the data: prefix */
  data: string;
  mimeType: "image/jpeg";
  /** object URL of the shrunk picture, for showing it next to the reading; revoke it when done */
  previewUrl: string;
}

export class ImageError extends Error {}

const MAX_SIDE = 1600;
const QUALITY = 0.85;

const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new ImageError("encode failed"))), "image/jpeg", QUALITY));

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(new ImageError("read failed"));
    r.readAsDataURL(blob);
  });

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) throw new ImageError("not an image");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageError("this picture cannot be opened here");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageError("no canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await toBlob(canvas);
  return { data: await toBase64(blob), mimeType: "image/jpeg", previewUrl: URL.createObjectURL(blob) };
}
