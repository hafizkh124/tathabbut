// Finding the picture in what the user dropped or pasted. Pure functions on the browser's DataTransfer, so they can be tested.

const isImage = (f: File | null | undefined): f is File => Boolean(f && f.type.startsWith("image/"));

/** The first picture among dropped files; null for anything else (text, links, other files). */
export function imageFromDrop(data: Pick<DataTransfer, "files"> | null | undefined): File | null {
  return Array.from(data?.files ?? []).find(isImage) ?? null;
}

/** The picture on the clipboard, but only when there is no text with it: copying from a page or a document often puts a
 *  picture AND its text on the clipboard, and then the text is what the person meant to paste. */
export function imageFromClipboard(data: Pick<DataTransfer, "files" | "types" | "getData"> | null | undefined): File | null {
  if (!data) return null;
  const hasText = Array.from(data.types ?? []).includes("text/plain") && data.getData("text/plain").trim() !== "";
  if (hasText) return null;
  return Array.from(data.files ?? []).find(isImage) ?? null;
}
