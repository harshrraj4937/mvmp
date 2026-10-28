/** Blank-line separated text as paragraphs. Plain text only: React escapes it. */
export function Paragraphs({ text }: { text: null | string }) {
  if (!text) {
    return null;
  }
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => <p key={index}>{paragraph}</p>);
}
