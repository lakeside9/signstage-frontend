/** Signature width is stored in PDF page units (points), before screen zoom. */
export const DEFAULT_SIGNATURE_WIDTH = 2;

export function signatureWidth(width: number | undefined, pageScale = 1): number {
  const base = typeof width === 'number' && Number.isFinite(width) && width > 0
    ? width : DEFAULT_SIGNATURE_WIDTH;
  return base * pageScale;
}

/** Display emphasis shared by projector and control previews, in CSS pixels. */
export function displaySignatureWidth(renderedPageWidth: number): number {
  return Math.max(2, 2.5 * (renderedPageWidth / 1280));
}
