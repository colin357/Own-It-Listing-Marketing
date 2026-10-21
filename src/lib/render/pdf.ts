import "server-only";
import { PDFDocument } from "pdf-lib";

/** Wrap a letter-size PNG in a single-page 8.5×11in PDF. */
export async function pngToLetterPdf(png: Uint8Array | ArrayBuffer, title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  const img = await doc.embedPng(png);
  const page = doc.addPage([612, 792]);
  page.drawImage(img, { x: 0, y: 0, width: 612, height: 792 });
  return doc.save();
}
